import { QUALITY_LADDER, bitrateOf, getScenario } from '../../data/demoScenarios'
import type { PlaybackEvent, PlaybackSession, PlaybackStatus, QualityId, ScenarioId } from '../../types/playback'

/**
 * Deterministic playback simulator. One `tick()` advances one second of simulated time.
 * Nothing here reads the wall clock or Math.random, so a given sequence of actions always
 * produces the same telemetry. The UI only decides how often to call tick().
 */
export const CLIP_SECONDS = 600 // a simulated 10-minute preview, not the full title
/** Small forward buffer, as on mobile and low-latency players, so network problems surface quickly. */
export const MAX_BUFFER_SECONDS = 12
export const RESUME_BUFFER_SECONDS = 3
/** A stall with no connectivity becomes a playback error after this long. */
export const ERROR_AFTER_OFFLINE_SECONDS = 8
export const SAMPLE_EVERY_SECONDS = 2
const ABR_SAFETY = 0.8
/** Stricter than ABR_SAFETY: hysteresis so the player doesn't flap between two rungs. */
const ABR_UPSWITCH_SAFETY = 0.6
const ABR_UPSWITCH_MIN_BUFFER = 10
const ESTIMATE_SMOOTHING = 0.15
const ABR_MIN_SECONDS_BETWEEN_SWITCHES = 4

export type QualityMode = 'auto' | QualityId

export interface EngineState {
  session: PlaybackSession | null
  status: PlaybackStatus | 'idle'
  positionSeconds: number
  bufferSeconds: number
  quality: QualityId
  qualityMode: QualityMode
  scenario: ScenarioId
  throughputMbps: number
  latencyMs: number
}

export interface EngineOptions {
  sessionId?: string
  titleId: string
  scenario?: ScenarioId
  qualityMode?: QualityMode
  /** Wall-clock start for display; defaults to 0 so tests are deterministic. */
  startedAt?: number
}

export class PlaybackEngine {
  private simS = 0
  private scenarioStartS = 0
  private estimateMbps: number | null = null
  private lastSwitchS = -Infinity
  private offlineS = 0
  private bufferStartS = 0
  private eventCount = 0
  private readonly sessionId: string
  private state: EngineState
  private readonly opts: EngineOptions

  constructor(opts: EngineOptions) {
    this.opts = opts
    this.sessionId = opts.sessionId ?? 's1'
    const qualityMode = opts.qualityMode ?? 'auto'
    this.state = {
      session: null,
      status: 'idle',
      positionSeconds: 0,
      bufferSeconds: 0,
      quality: qualityMode === 'auto' ? '720p' : qualityMode,
      qualityMode,
      scenario: opts.scenario ?? 'stable',
      throughputMbps: 0,
      latencyMs: 0,
    }
  }

  snapshot(): EngineState {
    return this.state
  }

  // ── Actions ───────────────────────────────────────────────────────────
  play() {
    const s = this.state
    if (s.status === 'playing' || s.status === 'buffering') return
    if (s.status === 'ended') return
    if (!s.session) {
      this.update({
        session: { id: this.sessionId, titleId: this.opts.titleId, startedAt: this.opts.startedAt ?? 0, elapsedMs: 0, status: 'playing', events: [] },
      })
      this.emit('network_change', { scenario: s.scenario, details: `Network: ${getScenario(s.scenario).label}` })
    }
    this.emit('play', { quality: s.quality, bitrateKbps: bitrateOf(s.quality) })
    this.setStatus('playing')
  }

  pause() {
    const s = this.state
    if (s.status !== 'playing' && s.status !== 'buffering') return
    if (s.status === 'buffering') this.endBuffering('Paused while buffering')
    this.emit('pause')
    this.setStatus('paused')
  }

  setScenario(id: ScenarioId) {
    if (id === this.state.scenario) return
    this.scenarioStartS = this.simS
    this.update({ scenario: id })
    if (this.state.session) this.emit('network_change', { scenario: id, details: `Network: ${getScenario(id).label}` })
  }

  setQualityMode(mode: QualityMode) {
    this.update({ qualityMode: mode })
    if (mode !== 'auto') this.switchQuality(mode, 'Selected by viewer')
  }

  // ── Simulation step: one second ───────────────────────────────────────
  tick() {
    const s = this.state
    if (!s.session || s.status === 'ended') return
    this.simS += 1
    const net = getScenario(s.scenario).at(this.simS - this.scenarioStartS)
    this.update({ throughputMbps: net.throughputMbps, latencyMs: net.latencyMs })
    this.estimateMbps = this.estimateMbps === null ? net.throughputMbps : (1 - ESTIMATE_SMOOTHING) * this.estimateMbps + ESTIMATE_SMOOTHING * net.throughputMbps
    this.offlineS = net.throughputMbps === 0 ? this.offlineS + 1 : 0

    // Download: seconds of video fetched this second = throughput / bitrate.
    const remaining = CLIP_SECONDS - s.positionSeconds
    const fetched = (net.throughputMbps * 1000) / bitrateOf(this.state.quality)
    let buffer = Math.min(MAX_BUFFER_SECONDS, remaining, this.state.bufferSeconds + fetched)

    if (this.state.status === 'error' && net.throughputMbps > 0) {
      this.emit('network_change', { throughputMbps: net.throughputMbps, latencyMs: net.latencyMs, details: 'Connection restored' })
      if (buffer >= RESUME_BUFFER_SECONDS) {
        this.emit('play', { quality: this.state.quality, bitrateKbps: bitrateOf(this.state.quality), details: 'Recovered after playback error' })
        this.setStatus('playing')
      } else {
        this.startBuffering(buffer, net)
      }
    }

    if (this.state.status === 'playing') {
      if (buffer >= 1) {
        buffer -= 1
        this.update({ positionSeconds: this.state.positionSeconds + 1 })
      } else {
        this.startBuffering(buffer, net)
      }
    } else if (this.state.status === 'buffering') {
      if (buffer >= Math.min(RESUME_BUFFER_SECONDS, CLIP_SECONDS - this.state.positionSeconds)) {
        this.endBuffering()
        this.setStatus('playing')
      } else if (this.offlineS > 0 && this.simS - this.bufferStartS >= ERROR_AFTER_OFFLINE_SECONDS) {
        this.endBuffering('Ended by playback error')
        this.emit('playback_error', { details: `Network unreachable: no data received for ${this.offlineS} s`, throughputMbps: 0 })
        this.setStatus('error')
      }
    }
    this.update({ bufferSeconds: Math.round(buffer * 100) / 100 })

    if (this.state.qualityMode === 'auto' && this.state.status !== 'error') this.adapt()

    if (this.simS % SAMPLE_EVERY_SECONDS === 0) {
      this.emit('telemetry_sample', {
        throughputMbps: net.throughputMbps,
        latencyMs: net.latencyMs,
        bitrateKbps: bitrateOf(this.state.quality),
        quality: this.state.quality,
        bufferSeconds: this.state.bufferSeconds,
      })
    }

    if (this.state.positionSeconds >= CLIP_SECONDS) {
      this.emit('ended')
      this.setStatus('ended')
    }
    this.update({ session: { ...this.state.session!, elapsedMs: this.simS * 1000 } })
  }

  /** Runs `seconds` ticks; used by tests and the "skip ahead" control. */
  advance(seconds: number) {
    for (let i = 0; i < seconds; i++) this.tick()
  }

  // ── Internals ─────────────────────────────────────────────────────────
  private adapt() {
    const est = this.estimateMbps ?? 0
    const current = bitrateOf(this.state.quality)
    const affordable = QUALITY_LADDER.find((l) => l.bitrateKbps <= est * 1000 * ABR_SAFETY) ?? QUALITY_LADDER.at(-1)!
    if (affordable.bitrateKbps < current) {
      this.switchQuality(affordable.id, `Auto: estimated throughput ${est.toFixed(1)} Mbps`)
      return
    }
    // Step up one rung at a time, only with a healthy buffer and clear headroom.
    const idx = QUALITY_LADDER.findIndex((l) => l.id === this.state.quality)
    const next = QUALITY_LADDER[idx - 1]
    if (
      next &&
      next.bitrateKbps <= est * 1000 * ABR_UPSWITCH_SAFETY &&
      this.state.bufferSeconds >= ABR_UPSWITCH_MIN_BUFFER &&
      this.simS - this.lastSwitchS >= ABR_MIN_SECONDS_BETWEEN_SWITCHES
    ) {
      this.switchQuality(next.id, `Auto: estimated throughput ${est.toFixed(1)} Mbps`)
    }
  }

  private switchQuality(to: QualityId, details: string) {
    const from = this.state.quality
    if (from === to) return
    this.lastSwitchS = this.simS
    this.update({ quality: to })
    if (this.state.session) this.emit('quality_change', { quality: to, fromQuality: from, bitrateKbps: bitrateOf(to), details })
  }

  private startBuffering(buffer: number, net: { throughputMbps: number; latencyMs: number }) {
    this.bufferStartS = this.simS
    this.emit('buffer_start', {
      throughputMbps: net.throughputMbps,
      latencyMs: net.latencyMs,
      bitrateKbps: bitrateOf(this.state.quality),
      quality: this.state.quality,
      bufferSeconds: Math.round(buffer * 100) / 100,
    })
    this.setStatus('buffering')
  }

  private endBuffering(details?: string) {
    this.emit('buffer_end', { durationMs: (this.simS - this.bufferStartS) * 1000, details })
  }

  private setStatus(status: PlaybackStatus) {
    this.update({ status, session: this.state.session ? { ...this.state.session, status } : null })
  }

  private emit(type: PlaybackEvent['type'], data: Partial<PlaybackEvent> = {}) {
    const session = this.state.session
    if (!session) return
    const event: PlaybackEvent = { id: `${this.sessionId}-e${++this.eventCount}`, sessionId: this.sessionId, timestamp: this.simS * 1000, type, ...data }
    this.update({ session: { ...session, events: [...session.events, event] } })
  }

  private update(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch }
  }
}

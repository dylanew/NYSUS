import type { PlaybackEvent, PlaybackSession, PlaybackStatus, QualityId } from '../../types/playback'

/**
 * Deterministic playback metrics, computed only from recorded events. The AI assistant
 * (Phase 4) will receive these numbers through tools; it never calculates them itself.
 */
export interface PlaybackMetrics {
  status: PlaybackStatus
  /** Time spent playing or buffering (paused time excluded), ms. */
  observedMs: number
  playingMs: number
  bufferingMs: number
  /** bufferingMs / observedMs × 100, rounded to 1 dp. 0 when nothing observed. */
  bufferingRatioPct: number
  bufferingEvents: number
  /** Buffering events per minute of observed time, 2 dp. */
  bufferingPerMinute: number
  averageThroughputMbps: number | null
  averageBitrateKbps: number | null
  averageLatencyMs: number | null
  errorCount: number
  qualityChanges: { eventId: string; timestamp: number; from?: QualityId; to?: QualityId }[]
  samples: number
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const r = (x: number | null, dp: number) => (x === null ? null : Math.round(x * 10 ** dp) / 10 ** dp)

/** Splits the session timeline into time spent in each state, using event timestamps. */
export function stateDurations(events: PlaybackEvent[], asOfMs: number): Record<'playing' | 'buffering' | 'paused' | 'error', number> {
  const totals = { playing: 0, buffering: 0, paused: 0, error: 0 }
  let state: keyof typeof totals | null = null
  let since = 0
  const enter = (next: keyof typeof totals | null, at: number) => {
    if (state) totals[state] += at - since
    state = next
    since = at
  }
  for (const e of events) {
    switch (e.type) {
      case 'play': enter('playing', e.timestamp); break
      case 'pause': enter('paused', e.timestamp); break
      case 'buffer_start': enter('buffering', e.timestamp); break
      // buffer_end followed by pause/error at the same timestamp is handled by those events.
      case 'buffer_end': if (state === 'buffering') enter('playing', e.timestamp); break
      case 'playback_error': enter('error', e.timestamp); break
      case 'ended': enter(null, e.timestamp); break
      default: break
    }
  }
  enter(null, Math.max(asOfMs, since))
  return totals
}

export function computeMetrics(session: PlaybackSession, windowMs?: { from: number; to: number }): PlaybackMetrics {
  const events = windowMs ? session.events.filter((e) => e.timestamp >= windowMs.from && e.timestamp <= windowMs.to) : session.events
  const asOf = windowMs?.to ?? session.elapsedMs
  const d = stateDurations(session.events.filter((e) => !windowMs || e.timestamp <= windowMs.to), asOf)
  // Within a window, subtract time before the window starts.
  const before = windowMs ? stateDurations(session.events.filter((e) => e.timestamp <= windowMs.from), windowMs.from) : { playing: 0, buffering: 0, paused: 0, error: 0 }
  const playingMs = d.playing - before.playing
  const bufferingMs = d.buffering - before.buffering
  const observedMs = playingMs + bufferingMs

  const samples = events.filter((e) => e.type === 'telemetry_sample')
  const bufferingEvents = events.filter((e) => e.type === 'buffer_start').length

  return {
    status: session.status,
    observedMs,
    playingMs,
    bufferingMs,
    bufferingRatioPct: observedMs > 0 ? Math.round((bufferingMs / observedMs) * 1000) / 10 : 0,
    bufferingEvents,
    bufferingPerMinute: observedMs > 0 ? Math.round((bufferingEvents / (observedMs / 60000)) * 100) / 100 : 0,
    averageThroughputMbps: r(mean(samples.map((s) => s.throughputMbps ?? 0)), 2),
    averageBitrateKbps: r(mean(samples.map((s) => s.bitrateKbps ?? 0)), 0),
    averageLatencyMs: r(mean(samples.filter((s) => (s.throughputMbps ?? 0) > 0).map((s) => s.latencyMs ?? 0)), 0),
    errorCount: events.filter((e) => e.type === 'playback_error').length,
    qualityChanges: events
      .filter((e) => e.type === 'quality_change')
      .map((e) => ({ eventId: e.id, timestamp: e.timestamp, from: e.fromQuality, to: e.quality })),
    samples: samples.length,
  }
}

export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

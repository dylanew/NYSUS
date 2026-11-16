import type { ScenarioId } from '../../types/playback'
import { createLiveMonitor, getService, type LiveMonitor, type MonitorSnapshot } from '../network/liveProbe'
import { PlaybackEngine, type EngineState, type QualityMode } from './engine'

/**
 * App-wide player: the simulation keeps running while you move between Player and
 * Stream Health. The timer only decides *when* to tick; the engine stays deterministic.
 */
export interface PlayerSnapshot extends EngineState {
  titleId: string | null
  /** Effective speed: always 1 in live mode, because the network can't be fast-forwarded. */
  speed: number
  live: MonitorSnapshot
}

type Listener = () => void

export interface Scheduler {
  setInterval(fn: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
}

const browserScheduler: Scheduler = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => globalThis.clearInterval(h as number),
}

export function createPlayerStore(
  scheduler: Scheduler = browserScheduler,
  now: () => number = Date.now,
  monitor: LiveMonitor = createLiveMonitor(),
) {
  let sessionCount = 0
  let engine: PlaybackEngine | null = null
  let titleId: string | null = null
  let speed = 1
  let timer: unknown = null
  let snapshot: PlayerSnapshot
  const listeners = new Set<Listener>()

  const isLive = () => engine?.snapshot().scenario === 'live'
  const effectiveSpeed = () => (isLive() ? 1 : speed)

  function emptySnapshot(): PlayerSnapshot {
    const probe = new PlaybackEngine({ titleId: '' }).snapshot()
    return { ...probe, titleId: null, speed: effectiveSpeed(), live: monitor.getSnapshot() }
  }

  function publish() {
    const base = engine ? engine.snapshot() : emptySnapshot()
    snapshot = { ...base, titleId, speed: effectiveSpeed(), live: monitor.getSnapshot() }
    listeners.forEach((l) => l())
  }

  /** Measure while live playback needs data, or until the first reading arrives. */
  function syncMonitor() {
    const status = engine?.snapshot().status
    const active = status === 'playing' || status === 'buffering' || status === 'error'
    const want = isLive() && (active || monitor.getSnapshot().latest === null) && monitor.getSnapshot().status !== 'budget_reached'
    if (want) monitor.start()
    else monitor.stop()
  }

  snapshot = emptySnapshot()

  monitor.subscribe(() => {
    syncMonitor()
    publish()
  })

  function syncTimer() {
    const status = engine?.snapshot().status
    const active = !!engine && status !== 'idle' && status !== 'ended'
    if (active && timer === null) {
      timer = scheduler.setInterval(() => {
        if (isLive()) engine?.setLiveSample(monitor.getSnapshot().latest)
        engine?.tick()
        publish()
        syncTimer()
      }, 1000 / effectiveSpeed())
    } else if (!active && timer !== null) {
      scheduler.clearInterval(timer)
      timer = null
    }
  }

  function restartTimer() {
    if (timer !== null) {
      scheduler.clearInterval(timer)
      timer = null
    }
    syncTimer()
  }

  const act = (fn: (e: PlaybackEngine) => void) => {
    if (!engine) return
    fn(engine)
    syncMonitor()
    publish()
    syncTimer()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(l: Listener) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    /** Loads a title. Keeps the current session if it's the same title. */
    load(id: string) {
      if (titleId === id && engine) return
      const prev = engine?.snapshot()
      titleId = id
      engine = new PlaybackEngine({
        titleId: id,
        sessionId: `s${++sessionCount}`,
        scenario: prev?.scenario,
        qualityMode: prev?.qualityMode,
        startedAt: now(),
      })
      if (prev?.scenario === 'live') engine.setLiveSample(monitor.getSnapshot().latest)
      restartTimer()
      syncMonitor()
      publish()
    },
    /** Starts a fresh session for the current title, keeping network and quality settings. */
    restart() {
      const id = titleId
      titleId = null
      if (isLive()) monitor.reset()
      if (id) this.load(id)
    },
    play: () => act((e) => e.play()),
    pause: () => act((e) => e.pause()),
    setScenario(id: ScenarioId) {
      act((e) => e.setScenario(id))
      if (id === 'live') act((e) => e.annotateNetwork(`Live latency measured to ${getService(monitor.getSnapshot().serviceId).label}`))
      restartTimer() // speed changes when entering or leaving live mode
    },
    setQualityMode: (m: QualityMode) => act((e) => e.setQualityMode(m)),
    /** Which service's website live latency is measured against. */
    setService(id: string) {
      monitor.setService(id)
      if (isLive()) act((e) => e.annotateNetwork(`Live latency now measured to ${getService(id).label}`))
    },
    /** Fast-forwards the simulation (e.g. to reach a scenario's interesting part in a demo). Not in live mode. */
    skip: (seconds: number) => {
      if (!isLive()) act((e) => e.advance(seconds))
    },
    setSpeed(s: number) {
      speed = s
      restartTimer()
      publish()
    },
  }
}

export type PlayerStore = ReturnType<typeof createPlayerStore>
export const playerStore = createPlayerStore()

import type { ScenarioId } from '../../types/playback'
import { PlaybackEngine, type EngineState, type QualityMode } from './engine'

/**
 * App-wide player: the simulation keeps running while you move between Player and
 * Stream Health. The timer only decides *when* to tick; the engine stays deterministic.
 */
export interface PlayerSnapshot extends EngineState {
  titleId: string | null
  speed: number
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

export function createPlayerStore(scheduler: Scheduler = browserScheduler, now: () => number = Date.now) {
  let sessionCount = 0
  let engine: PlaybackEngine | null = null
  let titleId: string | null = null
  let speed = 1
  let timer: unknown = null
  let snapshot: PlayerSnapshot = emptySnapshot()
  const listeners = new Set<Listener>()

  function emptySnapshot(): PlayerSnapshot {
    const probe = new PlaybackEngine({ titleId: '' }).snapshot()
    return { ...probe, titleId: null, speed }
  }

  function publish() {
    snapshot = engine ? { ...engine.snapshot(), titleId, speed } : { ...emptySnapshot(), titleId, speed }
    listeners.forEach((l) => l())
  }

  function syncTimer() {
    const status = engine?.snapshot().status
    const active = !!engine && status !== 'idle' && status !== 'ended'
    if (active && timer === null) {
      timer = scheduler.setInterval(() => {
        engine?.tick()
        publish()
        syncTimer()
      }, 1000 / speed)
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
      restartTimer()
      publish()
    },
    /** Starts a fresh session for the current title, keeping network and quality settings. */
    restart() {
      const id = titleId
      titleId = null
      if (id) this.load(id)
    },
    play: () => act((e) => e.play()),
    pause: () => act((e) => e.pause()),
    setScenario: (id: ScenarioId) => act((e) => e.setScenario(id)),
    setQualityMode: (m: QualityMode) => act((e) => e.setQualityMode(m)),
    /** Fast-forwards the simulation (e.g. to reach a scenario's interesting part in a demo). */
    skip: (seconds: number) => act((e) => e.advance(seconds)),
    setSpeed(s: number) {
      speed = s
      restartTimer()
      publish()
    },
  }
}

export type PlayerStore = ReturnType<typeof createPlayerStore>
export const playerStore = createPlayerStore()

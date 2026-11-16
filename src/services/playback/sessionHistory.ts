import type { PlaybackEvent, PlaybackSession, PlaybackStatus, ScenarioId } from '../../types/playback'
import { readJson, safeLocalStorage, writeJson, type KeyValueStorage } from '../persistence/localStorage'
import { computeMetrics } from './metrics'

/**
 * Saved playback sessions: a compact record of each session worth keeping (the summary
 * metrics, every notable event, and a thinned-out set of telemetry samples), small enough
 * for one Firestore document. Sessions shorter than MIN_OBSERVED_MS aren't kept.
 */
export interface SessionRecord {
  /** Unique across page loads: `${startedAt base36}-${session id}`. */
  id: string
  titleId: string
  startedAt: number
  updatedAt: number
  elapsedMs: number
  status: PlaybackStatus
  scenarios: ScenarioId[]
  metrics: {
    observedMs: number
    bufferingMs: number
    bufferingRatioPct: number
    bufferingEvents: number
    averageThroughputMbps: number | null
    averageBitrateKbps: number | null
    errorCount: number
    qualityChanges: number
  }
  /** Notable events plus at most MAX_SAMPLES telemetry samples. */
  events: PlaybackEvent[]
  /** Events in the full session, before thinning. */
  eventCount: number
}

export const MIN_OBSERVED_MS = 5000
export const MAX_LOCAL_SESSIONS = 10
export const MAX_NOTABLE_EVENTS = 150
export const MAX_SAMPLES = 60
const KEY = 'nysus.sessions.v1'

const STATUSES = new Set<PlaybackStatus>(['playing', 'paused', 'buffering', 'ended', 'error'])

export function recordId(session: Pick<PlaybackSession, 'id' | 'startedAt'>): string {
  return `${session.startedAt.toString(36)}-${session.id}`
}

/** Drops undefined fields, which Firestore rejects and which carry no information. */
function compactEvent(e: PlaybackEvent): PlaybackEvent {
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined)) as unknown as PlaybackEvent
}

/** Builds the record for a session, or null if it is too short to be worth keeping. */
export function toRecord(session: PlaybackSession, now: number): SessionRecord | null {
  const m = computeMetrics(session)
  if (m.observedMs < MIN_OBSERVED_MS) return null
  const notable = session.events.filter((e) => e.type !== 'telemetry_sample')
  const samples = session.events.filter((e) => e.type === 'telemetry_sample')
  const step = Math.max(1, Math.ceil(samples.length / MAX_SAMPLES))
  const thinned = samples.filter((_, i) => i % step === 0).slice(0, MAX_SAMPLES)
  const keptNotable = notable.slice(-MAX_NOTABLE_EVENTS)
  const events = [...keptNotable, ...thinned].sort((a, b) => a.timestamp - b.timestamp).map(compactEvent)
  const scenarios = [...new Set(session.events.map((e) => e.scenario).filter((s): s is ScenarioId => !!s))]
  return {
    id: recordId(session),
    titleId: session.titleId,
    startedAt: session.startedAt,
    updatedAt: now,
    elapsedMs: Math.round(session.elapsedMs),
    status: session.status,
    scenarios,
    metrics: {
      observedMs: m.observedMs,
      bufferingMs: m.bufferingMs,
      bufferingRatioPct: m.bufferingRatioPct,
      bufferingEvents: m.bufferingEvents,
      averageThroughputMbps: m.averageThroughputMbps,
      averageBitrateKbps: m.averageBitrateKbps,
      errorCount: m.errorCount,
      qualityChanges: m.qualityChanges.length,
    },
    events,
    eventCount: session.events.length,
  }
}

/** Shape check for records read back from storage or Firestore. */
export function parseRecord(v: unknown): SessionRecord | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const m = o.metrics as Record<string, unknown> | undefined
  if (typeof o.id !== 'string' || typeof o.titleId !== 'string' || typeof o.startedAt !== 'number' || typeof o.updatedAt !== 'number') return null
  if (typeof o.elapsedMs !== 'number' || !STATUSES.has(o.status as PlaybackStatus) || !Array.isArray(o.events) || !Array.isArray(o.scenarios)) return null
  if (!m || typeof m.bufferingRatioPct !== 'number' || typeof m.observedMs !== 'number') return null
  return v as SessionRecord
}

export function mergeSessions(a: SessionRecord[], b: SessionRecord[], limit = MAX_LOCAL_SESSIONS): SessionRecord[] {
  const byId = new Map<string, SessionRecord>()
  for (const r of [...a, ...b]) {
    const prev = byId.get(r.id)
    if (!prev || r.updatedAt > prev.updatedAt) byId.set(r.id, r)
  }
  return [...byId.values()].sort((x, y) => y.startedAt - x.startedAt).slice(0, limit)
}

export function createSessionHistoryStore(storage: KeyValueStorage | null = safeLocalStorage()) {
  const loaded = readJson(storage, KEY)
  let records: SessionRecord[] = Array.isArray(loaded) ? mergeSessions(loaded.map(parseRecord).filter((r): r is SessionRecord => r !== null), []) : []
  const listeners = new Set<() => void>()
  const changeListeners = new Set<(r: SessionRecord) => void>()

  function commit(next: SessionRecord[], changed?: SessionRecord) {
    records = next
    writeJson(storage, KEY, records)
    listeners.forEach((l) => l())
    if (changed) changeListeners.forEach((l) => l(changed))
  }

  return {
    getSnapshot: () => records,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    onChange(l: (r: SessionRecord) => void) {
      changeListeners.add(l)
      return () => changeListeners.delete(l)
    },
    save(record: SessionRecord) {
      commit(mergeSessions([record], records.filter((r) => r.id !== record.id)), record)
    },
    replaceAll(next: SessionRecord[]) {
      commit(mergeSessions(next, []))
    },
    clear() {
      commit([])
    },
  }
}

export type SessionHistoryStore = ReturnType<typeof createSessionHistoryStore>

export interface RecorderSource {
  getSnapshot(): { session: PlaybackSession | null }
  subscribe(l: () => void): () => void
}

/**
 * Watches the player and saves the current session: when its status changes (paused,
 * ended, error), when a new session replaces it, and otherwise at most every
 * `throttleMs` of wall-clock time. Returns flush() for page hide, and a stop function.
 */
export function recordSessions(player: RecorderSource, history: SessionHistoryStore, opts: { now?: () => number; throttleMs?: number } = {}) {
  const now = opts.now ?? Date.now
  const throttleMs = opts.throttleMs ?? 10_000
  let current: PlaybackSession | null = null
  let lastSavedAt = Number.NEGATIVE_INFINITY
  let lastStatus: PlaybackStatus | null = null

  const save = (session: PlaybackSession | null) => {
    if (!session) return
    const record = toRecord(session, now())
    if (!record) return
    history.save(record)
    lastSavedAt = now()
  }

  const onChange = () => {
    const session = player.getSnapshot().session
    if (current && session?.id !== current.id) {
      save(current) // the previous session is final now
      lastStatus = null
    }
    current = session
    if (!session) return
    const statusChanged = session.status !== lastStatus && (session.status === 'paused' || session.status === 'ended' || session.status === 'error')
    lastStatus = session.status
    if (statusChanged || now() - lastSavedAt >= throttleMs) save(session)
  }

  const stop = player.subscribe(onChange)
  return { flush: () => save(current), stop }
}

export const sessionHistoryStore = createSessionHistoryStore()

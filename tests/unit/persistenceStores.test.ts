import { describe, expect, it, vi } from 'vitest'
import { createWatchlistStore, mergeWatchlists, type WatchlistEntry } from '../../src/services/watchlist/watchlistStore'
import { createPreferencesStore, mergePreferences, parsePreferences, topInterests } from '../../src/services/preferences/preferencesStore'
import { createSessionHistoryStore, MAX_SAMPLES, MIN_OBSERVED_MS, mergeSessions, parseRecord, recordSessions, toRecord } from '../../src/services/playback/sessionHistory'
import { PlaybackEngine } from '../../src/services/playback/engine'
import type { ViewerPreferences } from '../../src/services/ai/schemas'
import type { KeyValueStorage } from '../../src/services/persistence/localStorage'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

const w = (titleId: string, updatedAt: number, watched = false, addedAt = updatedAt): WatchlistEntry => ({ titleId, addedAt, watched, updatedAt })

describe('watchlist sync support', () => {
  it('emits one change per local edit, and none for replaceAll or clear', () => {
    let t = 10
    const store = createWatchlistStore(memoryStorage(), () => t++)
    const changes = vi.fn()
    store.onChange(changes)
    store.add('arrival')
    store.setWatched('arrival', true)
    store.remove('arrival')
    store.remove('arrival') // no-op
    store.replaceAll([w('dune', 1)])
    store.clear()
    expect(changes.mock.calls.map((c) => c[0].type)).toEqual(['upsert', 'upsert', 'remove'])
    expect(changes.mock.calls[1]![0].entry).toMatchObject({ titleId: 'arrival', watched: true, addedAt: 10, updatedAt: 11 })
  })

  it('upgrades entries saved before updatedAt existed', () => {
    const storage = memoryStorage({ 'nysus.watchlist.v1': JSON.stringify([{ titleId: 'arrival', addedAt: 5, watched: true }]) })
    expect(createWatchlistStore(storage).getSnapshot()).toEqual([{ titleId: 'arrival', addedAt: 5, watched: true, updatedAt: 5 }])
  })

  it('merges two copies: newest change per title wins, earliest addedAt kept, nothing lost', () => {
    const device = [w('arrival', 20, true, 1), w('dune', 5)]
    const account = [w('arrival', 10, false, 3), w('moon', 7)]
    const merged = mergeWatchlists(device, account)
    expect(merged.map((e) => e.titleId).sort()).toEqual(['arrival', 'dune', 'moon'])
    expect(merged.find((e) => e.titleId === 'arrival')).toEqual({ titleId: 'arrival', addedAt: 1, watched: true, updatedAt: 20 })
    expect(mergeWatchlists(account, device)).toEqual(merged)
  })
})

const prefs = (over: Partial<ViewerPreferences> = {}): ViewerPreferences => ({
  genres: ['science fiction'], moods: ['dark'], preferredThemes: ['space exploration'], excludeGenres: [], contentType: 'film', length: 'any', confidence: 0.8, ...over,
})

describe('preferences store', () => {
  it('records structured interests only, newest first, and persists them', () => {
    const storage = memoryStorage()
    let t = 100
    const store = createPreferencesStore(storage, () => t++)
    const changed = vi.fn()
    store.onChange(changed)
    store.record(prefs(), 'on_device')
    store.record(prefs({ genres: ['comedy'], moods: ['light-hearted'], preferredThemes: [] }), 'in_cloud')
    store.record(prefs({ genres: [], moods: [], preferredThemes: [] }), 'keywords') // says nothing: ignored
    const s = store.getSnapshot()
    expect(s.interests.map((i) => i.source)).toEqual(['in_cloud', 'on_device'])
    expect(Object.keys(s.interests[0]!).sort()).toEqual(['at', 'contentType', 'genres', 'moods', 'source', 'themes'])
    expect(changed).toHaveBeenCalledTimes(2)
    expect(createPreferencesStore(storage).getSnapshot()).toEqual(s)
    expect(topInterests(s, 'genres')).toEqual(['comedy', 'science fiction'])
  })

  it('caps history and drops malformed entries', () => {
    const store = createPreferencesStore(memoryStorage(), (() => { let t = 0; return () => ++t })())
    for (let i = 0; i < 20; i++) store.record(prefs(), 'on_device')
    expect(store.getSnapshot().interests).toHaveLength(12)
    expect(parsePreferences({ interests: [{ at: 1, genres: 'x' }, null], updatedAt: 'no' })).toEqual({ interests: [], updatedAt: 0 })
  })

  it('merges by time without duplicates', () => {
    const a = parsePreferences({ interests: [{ at: 2, genres: ['a'], moods: [], themes: [], contentType: 'any', source: 'keywords' }], updatedAt: 2 })
    const b = parsePreferences({ interests: [{ at: 2, genres: ['a'], moods: [], themes: [], contentType: 'any', source: 'keywords' }, { at: 1, genres: ['b'], moods: [], themes: [], contentType: 'any', source: 'keywords' }], updatedAt: 1 })
    expect(mergePreferences(a, b).interests.map((i) => i.at)).toEqual([2, 1])
  })
})

function played(seconds: number, scenario: 'poor' | 'stable' = 'poor', sessionId = 's1') {
  const engine = new PlaybackEngine({ titleId: 'interstellar', sessionId, scenario, startedAt: 1_700_000_000_000 })
  engine.play()
  engine.advance(seconds)
  return engine
}

describe('playback session records', () => {
  it('summarises a session with its metrics, keeps notable events and thins samples', () => {
    const session = played(600).snapshot().session!
    const r = toRecord(session, 5)!
    expect(r.id).toBe(`${(1_700_000_000_000).toString(36)}-s1`)
    expect(r.metrics.bufferingEvents).toBeGreaterThan(0)
    expect(r.scenarios).toEqual(['poor'])
    const samples = r.events.filter((e) => e.type === 'telemetry_sample')
    expect(samples.length).toBeLessThanOrEqual(MAX_SAMPLES)
    expect(r.events.filter((e) => e.type === 'buffer_start')).toHaveLength(session.events.filter((e) => e.type === 'buffer_start').length)
    expect(r.eventCount).toBe(session.events.length)
    expect(JSON.stringify(r)).not.toContain('undefined')
    expect(parseRecord(JSON.parse(JSON.stringify(r)))).toEqual(r)
  })

  it('skips sessions too short to matter', () => {
    expect(toRecord(played(MIN_OBSERVED_MS / 1000 - 2).snapshot().session!, 1)).toBeNull()
  })

  it('keeps the newest version of each session and the newest sessions overall', () => {
    const r1 = toRecord(played(30, 'stable', 's1').snapshot().session!, 1)!
    const r1b = { ...r1, updatedAt: 9, elapsedMs: 99 }
    const merged = mergeSessions([r1], [r1b])
    expect(merged).toEqual([r1b])
    const many = Array.from({ length: 15 }, (_, i) => ({ ...r1, id: `x-s${i}`, startedAt: i }))
    expect(mergeSessions(many, []).map((r) => r.startedAt)[0]).toBe(14)
    expect(mergeSessions(many, [])).toHaveLength(10)
  })

  it('records the player: on pause, when a new session replaces it, and throttled in between', () => {
    let session = played(30).snapshot().session
    const listeners = new Set<() => void>()
    const player = { getSnapshot: () => ({ session }), subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)) }
    const history = createSessionHistoryStore(memoryStorage())
    let t = 0
    const rec = recordSessions(player, history, { now: () => t, throttleMs: 10_000 })
    const emit = () => listeners.forEach((l) => l())

    emit() // first sight: saved (throttle window starts empty)
    expect(history.getSnapshot()).toHaveLength(1)
    t = 1000
    session = { ...session!, elapsedMs: session!.elapsedMs + 1000 }
    emit() // within throttle: not saved again
    expect(history.getSnapshot()[0]!.updatedAt).toBe(0)
    session = { ...session, status: 'paused' }
    emit() // status change: saved
    expect(history.getSnapshot()[0]!.status).toBe('paused')

    session = played(20, 'stable', 's2').snapshot().session
    emit() // s1 is final and saved; s2 waits for the throttle window
    expect(history.getSnapshot()).toHaveLength(1)
    t = 20_000
    emit()
    expect(history.getSnapshot().map((r) => r.id.split('-')[1]).sort()).toEqual(['s1', 's2'])
    rec.stop()
  })
})

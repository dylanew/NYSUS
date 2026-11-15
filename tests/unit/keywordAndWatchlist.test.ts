import { describe, expect, it, vi } from 'vitest'
import { extractPreferencesByKeywords } from '../../src/services/recommendations/keywordExtraction'
import { createWatchlistStore, type KeyValueStorage } from '../../src/services/watchlist/watchlistStore'

describe('extractPreferencesByKeywords', () => {
  it('finds genres, moods, type and length', () => {
    const p = extractPreferencesByKeywords('A short, light-hearted series I can finish this weekend', 2026)
    expect(p).toMatchObject({ moods: ['light-hearted'], contentType: 'series', length: 'short', confidence: 0.3 })
  })
  it('maps synonyms and the "last ten years" phrase', () => {
    const p = extractPreferencesByKeywords('A dark sci-fi movie from the last ten years', 2026)
    expect(p.genres).toEqual(['science fiction'])
    expect(p.moods).toEqual(['dark'])
    expect(p.releaseAfter).toBe(2016)
    expect(p.contentType).toBe('film')
  })
})

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = { ...initial }
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

describe('watchlist store', () => {
  it('adds, marks watched and removes, persisting each change', () => {
    const storage = memoryStorage()
    const store = createWatchlistStore(storage, () => 1)
    const listener = vi.fn()
    store.subscribe(listener)
    store.add('arrival')
    store.add('arrival')
    store.setWatched('arrival', true)
    expect(store.getSnapshot()).toEqual([{ titleId: 'arrival', addedAt: 1, watched: true }])
    expect(createWatchlistStore(storage).getSnapshot()).toHaveLength(1)
    store.remove('arrival')
    expect(store.getSnapshot()).toEqual([])
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('survives corrupt or blocked storage', () => {
    expect(createWatchlistStore(memoryStorage({ 'nysus.watchlist.v1': '{nope' })).getSnapshot()).toEqual([])
    const throwing: KeyValueStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    const store = createWatchlistStore(throwing)
    store.add('dune')
    expect(store.has('dune')).toBe(true)
  })
})

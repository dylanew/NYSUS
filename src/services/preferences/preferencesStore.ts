import type { ViewerPreferences } from '../ai/schemas'
import { readJson, safeLocalStorage, writeJson, type KeyValueStorage } from '../persistence/localStorage'

/**
 * Viewer preferences learnt from discovery: the structured interests each request was
 * reduced to (genres, moods, themes), never the request text itself. Together with the
 * watchlist this is what "Your taste" shows and what get_viewer_preferences returns.
 */
export interface DiscoveryInterest {
  at: number
  genres: string[]
  moods: string[]
  themes: string[]
  contentType: 'film' | 'series' | 'any'
  /** How the interests were extracted: by the on-device model, the cloud model, or keyword matching. */
  source: 'on_device' | 'in_cloud' | 'keywords'
}

export interface PreferencesState {
  interests: DiscoveryInterest[]
  updatedAt: number
}

export const MAX_INTERESTS = 12
const MAX_LABELS = 10
const KEY = 'nysus.preferences.v1'

const labels = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]).slice(0, MAX_LABELS).map((s) => s.slice(0, 60)) : null

export function parseInterest(v: unknown): DiscoveryInterest | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const genres = labels(o.genres)
  const moods = labels(o.moods)
  const themes = labels(o.themes)
  if (typeof o.at !== 'number' || !genres || !moods || !themes) return null
  if (o.contentType !== 'film' && o.contentType !== 'series' && o.contentType !== 'any') return null
  if (o.source !== 'on_device' && o.source !== 'in_cloud' && o.source !== 'keywords') return null
  return { at: o.at, genres, moods, themes, contentType: o.contentType, source: o.source }
}

export function parsePreferences(v: unknown): PreferencesState {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>
  const interests = Array.isArray(o.interests) ? o.interests.map(parseInterest).filter((x): x is DiscoveryInterest => x !== null) : []
  return { interests: interests.sort((a, b) => b.at - a.at).slice(0, MAX_INTERESTS), updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : 0 }
}

/** Union of two histories, newest first, de-duplicated by time. */
export function mergePreferences(a: PreferencesState, b: PreferencesState): PreferencesState {
  const byAt = new Map<number, DiscoveryInterest>()
  for (const i of [...a.interests, ...b.interests]) byAt.set(i.at, i)
  return {
    interests: [...byAt.values()].sort((x, y) => y.at - x.at).slice(0, MAX_INTERESTS),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  }
}

export function interestFrom(p: ViewerPreferences, source: DiscoveryInterest['source'], at: number): DiscoveryInterest | null {
  if (p.genres.length + p.moods.length + p.preferredThemes.length === 0) return null
  return { at, genres: p.genres.slice(0, MAX_LABELS), moods: p.moods.slice(0, MAX_LABELS), themes: p.preferredThemes.slice(0, MAX_LABELS), contentType: p.contentType, source }
}

export function createPreferencesStore(storage: KeyValueStorage | null = safeLocalStorage(), now: () => number = Date.now) {
  let state = parsePreferences(readJson(storage, KEY))
  const listeners = new Set<() => void>()
  const changeListeners = new Set<(s: PreferencesState) => void>()

  function commit(next: PreferencesState, emitChange: boolean) {
    state = next
    writeJson(storage, KEY, state)
    listeners.forEach((l) => l())
    if (emitChange) changeListeners.forEach((l) => l(state))
  }

  return {
    getSnapshot: () => state,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    onChange(l: (s: PreferencesState) => void) {
      changeListeners.add(l)
      return () => changeListeners.delete(l)
    },
    /** Records what a discovery request was about. Ignores requests that named nothing. */
    record(p: ViewerPreferences, source: DiscoveryInterest['source']) {
      const t = now()
      const interest = interestFrom(p, source, t)
      if (!interest) return
      commit({ interests: [interest, ...state.interests].slice(0, MAX_INTERESTS), updatedAt: t }, true)
    },
    replace(next: PreferencesState) {
      commit(next, false)
    },
    clear() {
      commit({ interests: [], updatedAt: 0 }, false)
    },
  }
}

export type PreferencesStore = ReturnType<typeof createPreferencesStore>

/** Top labels across recent requests, newer requests weighted more. */
export function topInterests(state: PreferencesState, field: 'genres' | 'moods' | 'themes', n = 5): string[] {
  const score: Record<string, number> = {}
  state.interests.forEach((i, idx) => {
    for (const label of i[field]) score[label] = (score[label] ?? 0) + 1 / (1 + idx * 0.25)
  })
  return Object.entries(score)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k)
}

export const preferencesStore = createPreferencesStore()

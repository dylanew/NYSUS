import { safeLocalStorage, type KeyValueStorage } from '../persistence/localStorage'

export type { KeyValueStorage } from '../persistence/localStorage'

/**
 * Watchlist. The browser copy (localStorage) is what the UI reads, so the app works offline
 * and as a guest; when an account is active, cloudSync mirrors every change to Firestore.
 * Storage access is wrapped: private windows or blocked storage fall back to memory.
 */
export interface WatchlistEntry {
  titleId: string
  addedAt: number
  watched: boolean
  /** Last change, used to merge this device's copy with the account's. */
  updatedAt: number
}

/** A single change, emitted for local edits so cloud sync can write just that document. */
export type WatchlistChange = { type: 'upsert'; entry: WatchlistEntry } | { type: 'remove'; titleId: string }

type Listener = () => void

const KEY = 'nysus.watchlist.v1'
export const MAX_WATCHLIST = 200

function isEntry(e: unknown): e is Omit<WatchlistEntry, 'updatedAt'> & { updatedAt?: number } {
  if (typeof e !== 'object' || e === null) return false
  const o = e as Record<string, unknown>
  return typeof o.titleId === 'string' && typeof o.addedAt === 'number' && typeof o.watched === 'boolean'
}

export function createWatchlistStore(storage: KeyValueStorage | null = safeLocalStorage(), now: () => number = Date.now) {
  let entries: WatchlistEntry[] = load()
  const listeners = new Set<Listener>()
  const changeListeners = new Set<(c: WatchlistChange) => void>()

  function load(): WatchlistEntry[] {
    try {
      const raw = storage?.getItem(KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed)) return []
      // Entries saved before Phase 5 have no updatedAt; their addedAt is the best estimate.
      return parsed.filter(isEntry).map((e) => ({ ...e, updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : e.addedAt }))
    } catch {
      return []
    }
  }

  function commit(next: WatchlistEntry[], change?: WatchlistChange) {
    entries = next
    try {
      storage?.setItem(KEY, JSON.stringify(entries))
    } catch {
      // Storage full or blocked: keep the in-memory copy.
    }
    listeners.forEach((l) => l())
    if (change) changeListeners.forEach((l) => l(change))
  }

  return {
    getSnapshot: () => entries,
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Local edits only; replaceAll and clear do not emit. */
    onChange(listener: (c: WatchlistChange) => void) {
      changeListeners.add(listener)
      return () => changeListeners.delete(listener)
    },
    has: (titleId: string) => entries.some((e) => e.titleId === titleId),
    add(titleId: string) {
      if (entries.some((e) => e.titleId === titleId) || entries.length >= MAX_WATCHLIST) return
      const t = now()
      const entry = { titleId, addedAt: t, watched: false, updatedAt: t }
      commit([entry, ...entries], { type: 'upsert', entry })
    },
    remove(titleId: string) {
      if (!entries.some((e) => e.titleId === titleId)) return
      commit(
        entries.filter((e) => e.titleId !== titleId),
        { type: 'remove', titleId },
      )
    },
    setWatched(titleId: string, watched: boolean) {
      const t = now()
      const existing = entries.find((e) => e.titleId === titleId)
      if (!existing && entries.length >= MAX_WATCHLIST) return
      const entry = existing ? { ...existing, watched, updatedAt: t } : { titleId, addedAt: t, watched, updatedAt: t }
      commit(existing ? entries.map((e) => (e.titleId === titleId ? entry : e)) : [entry, ...entries], { type: 'upsert', entry })
    },
    /** Replaces everything, e.g. with the merged account copy after sign-in. */
    replaceAll(next: WatchlistEntry[]) {
      commit([...next].sort((a, b) => b.addedAt - a.addedAt).slice(0, MAX_WATCHLIST))
    },
    clear() {
      commit([])
    },
  }
}

export type WatchlistStore = ReturnType<typeof createWatchlistStore>

/**
 * Merges two copies of a watchlist (this device and the account). The newer change to each
 * title wins. Removals aren't tracked, so a title deleted on one device while signed out
 * comes back on merge: the safe direction for a watchlist.
 */
export function mergeWatchlists(a: WatchlistEntry[], b: WatchlistEntry[]): WatchlistEntry[] {
  const byId = new Map<string, WatchlistEntry>()
  for (const e of [...a, ...b]) {
    const prev = byId.get(e.titleId)
    if (!prev || e.updatedAt > prev.updatedAt) byId.set(e.titleId, { ...e, addedAt: Math.min(e.addedAt, prev?.addedAt ?? e.addedAt) })
    else byId.set(e.titleId, { ...prev, addedAt: Math.min(e.addedAt, prev.addedAt) })
  }
  return [...byId.values()].sort((x, y) => y.addedAt - x.addedAt)
}

export const watchlistStore = createWatchlistStore()

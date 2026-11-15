/**
 * Watchlist kept in the browser (per device) until Firestore persistence in Phase 5.
 * Storage access is wrapped: private windows or blocked storage fall back to memory.
 */
export interface WatchlistEntry {
  titleId: string
  addedAt: number
  watched: boolean
}

type Listener = () => void

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const KEY = 'nysus.watchlist.v1'

export function createWatchlistStore(storage: KeyValueStorage | null = safeLocalStorage(), now: () => number = Date.now) {
  let entries: WatchlistEntry[] = load()
  const listeners = new Set<Listener>()

  function load(): WatchlistEntry[] {
    try {
      const raw = storage?.getItem(KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (e): e is WatchlistEntry =>
          typeof e === 'object' && e !== null && typeof e.titleId === 'string' && typeof e.addedAt === 'number' && typeof e.watched === 'boolean',
      )
    } catch {
      return []
    }
  }

  function commit(next: WatchlistEntry[]) {
    entries = next
    try {
      storage?.setItem(KEY, JSON.stringify(entries))
    } catch {
      // Storage full or blocked: keep the in-memory copy.
    }
    listeners.forEach((l) => l())
  }

  return {
    getSnapshot: () => entries,
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    has: (titleId: string) => entries.some((e) => e.titleId === titleId),
    add(titleId: string) {
      if (entries.some((e) => e.titleId === titleId)) return
      commit([{ titleId, addedAt: now(), watched: false }, ...entries])
    },
    remove(titleId: string) {
      commit(entries.filter((e) => e.titleId !== titleId))
    },
    setWatched(titleId: string, watched: boolean) {
      const exists = entries.some((e) => e.titleId === titleId)
      commit(
        exists
          ? entries.map((e) => (e.titleId === titleId ? { ...e, watched } : e))
          : [{ titleId, addedAt: now(), watched }, ...entries],
      )
    },
  }
}

export type WatchlistStore = ReturnType<typeof createWatchlistStore>

function safeLocalStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export const watchlistStore = createWatchlistStore()

import { useMemo, useSyncExternalStore } from 'react'
import { getTitle } from '../services/catalogue/catalogue'
import { buildProfile } from '../services/recommendations/ranking'
import { watchlistStore, type WatchlistStore } from '../services/watchlist/watchlistStore'
import type { MediaTitle } from '../types/media'

export function useWatchlist(store: WatchlistStore = watchlistStore) {
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const items = useMemo(
    () =>
      entries
        .map((e) => ({ ...e, title: getTitle(e.titleId) }))
        .filter((e): e is typeof e & { title: MediaTitle } => e.title !== undefined),
    [entries],
  )
  const profile = useMemo(() => buildProfile(items), [items])
  return {
    items,
    profile,
    has: (id: string) => entries.some((e) => e.titleId === id),
    isWatched: (id: string) => entries.some((e) => e.titleId === id && e.watched),
    add: store.add,
    remove: store.remove,
    setWatched: store.setWatched,
  }
}

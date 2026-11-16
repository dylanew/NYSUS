import { useSyncExternalStore } from 'react'

interface Readable<T> {
  getSnapshot(): T
  subscribe(l: () => void): () => void
}

/** Subscribes a component to one of the app's small external stores. */
export function useStore<T>(store: Readable<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

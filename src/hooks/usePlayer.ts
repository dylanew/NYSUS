import { useSyncExternalStore } from 'react'
import { playerStore, type PlayerStore } from '../services/playback/playerStore'

export function usePlayer(store: PlayerStore = playerStore) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return { state, store }
}

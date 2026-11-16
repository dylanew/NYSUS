import { mergePreferences, type PreferencesStore } from '../preferences/preferencesStore'
import { mergeSessions, type SessionHistoryStore } from '../playback/sessionHistory'
import { mergeWatchlists, type WatchlistStore } from '../watchlist/watchlistStore'
import type { RemoteRepo } from './remoteRepo'

export type SyncStatus = 'connecting' | 'synced' | 'saving' | 'error'

export interface SyncStores {
  watchlist: WatchlistStore
  preferences: PreferencesStore
  sessions: SessionHistoryStore
}

/**
 * Mirrors the local stores into one user's documents.
 *
 * On start: load the account's copy, merge it with this device's (newer change wins per
 * item), keep the merge locally and write back whatever the account was missing. After
 * that, every local change is written through as a single-document write. The local stores
 * stay the source the UI reads, so a slow or failed write never blocks the app.
 */
export function startCloudSync(uid: string, repo: RemoteRepo, stores: SyncStores, onStatus: (s: SyncStatus, error?: string) => void) {
  let stopped = false
  let inFlight = 0
  let lastError: string | undefined

  const track = (p: Promise<void>) => {
    inFlight++
    onStatus('saving')
    p.then(
      () => {
        lastError = undefined
      },
      (err: unknown) => {
        lastError = err instanceof Error ? err.message : String(err)
      },
    ).finally(() => {
      inFlight--
      if (!stopped && inFlight === 0) onStatus(lastError ? 'error' : 'synced', lastError)
    })
  }

  const unsubs = [
    stores.watchlist.onChange((c) => track(c.type === 'upsert' ? repo.putWatch(uid, c.entry) : repo.deleteWatch(uid, c.titleId))),
    stores.preferences.onChange((p) => track(repo.putPreferences(uid, p))),
    stores.sessions.onChange((r) => track(repo.putSession(uid, r))),
  ]

  onStatus('connecting')
  const ready = repo.load(uid).then(
    (remote) => {
      if (stopped) return
      const localWatch = stores.watchlist.getSnapshot()
      const watch = mergeWatchlists(localWatch, remote.watchlist)
      stores.watchlist.replaceAll(watch)
      const remoteById = new Map(remote.watchlist.map((e) => [e.titleId, e]))
      const writes: Promise<void>[] = watch.filter((e) => remoteById.get(e.titleId)?.updatedAt !== e.updatedAt).map((e) => repo.putWatch(uid, e))

      const localPrefs = stores.preferences.getSnapshot()
      const prefs = remote.preferences ? mergePreferences(localPrefs, remote.preferences) : localPrefs
      stores.preferences.replace(prefs)
      if (prefs.interests.length > (remote.preferences?.interests.length ?? 0) || prefs.updatedAt !== (remote.preferences?.updatedAt ?? 0))
        writes.push(repo.putPreferences(uid, prefs))

      const localSessions = stores.sessions.getSnapshot()
      const remoteIds = new Map(remote.sessions.map((r) => [r.id, r.updatedAt]))
      stores.sessions.replaceAll(mergeSessions(localSessions, remote.sessions))
      for (const r of localSessions) if (remoteIds.get(r.id) !== r.updatedAt) writes.push(repo.putSession(uid, r))

      if (writes.length) track(Promise.all(writes).then(() => undefined))
      else onStatus('synced')
    },
    (err: unknown) => {
      if (!stopped) onStatus('error', err instanceof Error ? err.message : String(err))
    },
  )

  return {
    ready,
    stop() {
      stopped = true
      unsubs.forEach((u) => u())
    },
  }
}

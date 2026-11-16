import type { PreferencesState } from '../preferences/preferencesStore'
import type { SessionRecord } from '../playback/sessionHistory'
import type { WatchlistEntry } from '../watchlist/watchlistStore'

export interface RemoteData {
  watchlist: WatchlistEntry[]
  preferences: PreferencesState | null
  sessions: SessionRecord[]
}

/**
 * What cloud sync needs from a database, per signed-in user. Firestore implements it in
 * firestoreRepo.ts; tests use an in-memory fake. Every method is scoped to one uid, and the
 * security rules only let that uid read or write it.
 */
export interface RemoteRepo {
  load(uid: string): Promise<RemoteData>
  putWatch(uid: string, entry: WatchlistEntry): Promise<void>
  deleteWatch(uid: string, titleId: string): Promise<void>
  putPreferences(uid: string, prefs: PreferencesState): Promise<void>
  putSession(uid: string, record: SessionRecord): Promise<void>
  /** Deletes everything stored for this user. */
  deleteAll(uid: string): Promise<void>
}

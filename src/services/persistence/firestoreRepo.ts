import { collection, deleteDoc, doc, getDoc, getDocs, initializeFirestore, limit, orderBy, query, setDoc, writeBatch, type Firestore } from 'firebase/firestore'
import type { FirebaseApp } from 'firebase/app'
import { parsePreferences } from '../preferences/preferencesStore'
import { MAX_LOCAL_SESSIONS, parseRecord, type SessionRecord } from '../playback/sessionHistory'
import type { WatchlistEntry } from '../watchlist/watchlistStore'
import type { RemoteRepo } from './remoteRepo'

/**
 * Firestore layout (see firestore.rules for what each document may contain):
 *
 *   users/{uid}/watchlist/{titleId}          { titleId, addedAt, watched, updatedAt }
 *   users/{uid}/preferences/profile          { interests: [...], updatedAt }
 *   users/{uid}/playbackSessions/{recordId}  SessionRecord
 *
 * Nothing else is stored: no email, no profile photo, no assistant conversations.
 */
export const paths = {
  watchlist: (uid: string) => `users/${uid}/watchlist`,
  preferences: (uid: string) => `users/${uid}/preferences/profile`,
  sessions: (uid: string) => `users/${uid}/playbackSessions`,
}

let db: Firestore | null = null

export function getDb(app: FirebaseApp): Firestore {
  // ignoreUndefinedProperties: optional event fields are simply left out.
  db ??= initializeFirestore(app, { ignoreUndefinedProperties: true })
  return db
}

const isWatchEntry = (v: Record<string, unknown>): boolean =>
  typeof v.titleId === 'string' && typeof v.addedAt === 'number' && typeof v.watched === 'boolean' && typeof v.updatedAt === 'number'

export function createFirestoreRepo(firestore: Firestore): RemoteRepo {
  return {
    async load(uid) {
      const [w, p, s] = await Promise.all([
        getDocs(collection(firestore, paths.watchlist(uid))),
        getDoc(doc(firestore, paths.preferences(uid))),
        getDocs(query(collection(firestore, paths.sessions(uid)), orderBy('startedAt', 'desc'), limit(MAX_LOCAL_SESSIONS))),
      ])
      return {
        watchlist: w.docs.map((d) => d.data()).filter(isWatchEntry) as unknown as WatchlistEntry[],
        preferences: p.exists() ? parsePreferences(p.data()) : null,
        sessions: s.docs.map((d) => parseRecord(d.data())).filter((r): r is SessionRecord => r !== null),
      }
    },
    putWatch: (uid, e) =>
      setDoc(doc(firestore, paths.watchlist(uid), e.titleId), { titleId: e.titleId, addedAt: e.addedAt, watched: e.watched, updatedAt: e.updatedAt }),
    deleteWatch: (uid, titleId) => deleteDoc(doc(firestore, paths.watchlist(uid), titleId)),
    putPreferences: (uid, prefs) => setDoc(doc(firestore, paths.preferences(uid)), { interests: prefs.interests, updatedAt: prefs.updatedAt }),
    putSession: (uid, r) => setDoc(doc(firestore, paths.sessions(uid), r.id), r),
    async deleteAll(uid) {
      const [w, s] = await Promise.all([getDocs(collection(firestore, paths.watchlist(uid))), getDocs(collection(firestore, paths.sessions(uid)))])
      const refs = [...w.docs.map((d) => d.ref), ...s.docs.map((d) => d.ref), doc(firestore, paths.preferences(uid))]
      // Batches hold at most 500 writes.
      for (let i = 0; i < refs.length; i += 450) {
        const batch = writeBatch(firestore)
        refs.slice(i, i + 450).forEach((r) => batch.delete(r))
        await batch.commit()
      }
    },
  }
}

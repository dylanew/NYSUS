import { useSyncExternalStore } from 'react'
import type { FirebaseApp } from 'firebase/app'
import { createAccountStore, type AccountStore } from '../services/account/accountStore'
import { getFirebase } from '../services/firebase/app'
import type { AuthAdapter } from '../services/firebase/auth'
import type { RemoteRepo } from '../services/persistence/remoteRepo'
import { preferencesStore } from '../services/preferences/preferencesStore'
import { sessionHistoryStore } from '../services/playback/sessionHistory'
import { watchlistStore } from '../services/watchlist/watchlistStore'

let appStore: AccountStore | null = null

/**
 * Firebase Auth and Firestore are loaded after the first screen (they are a large share of
 * the bundle); these wrappers forward each call once the real module has arrived.
 */
function lazyAuth(app: FirebaseApp): AuthAdapter {
  const real = import('../services/firebase/auth').then((m) => m.createFirebaseAuthAdapter(app))
  return {
    onUserChanged(cb) {
      let unsub: (() => void) | null = null
      let cancelled = false
      void real.then((a) => {
        if (!cancelled) unsub = a.onUserChanged(cb)
      })
      return () => {
        cancelled = true
        unsub?.()
      }
    },
    signInAsGuest: async () => (await real).signInAsGuest(),
    signInWithGoogle: async () => (await real).signInWithGoogle(),
    signOut: async () => (await real).signOut(),
    completeRedirect: async () => (await real).completeRedirect(),
  }
}

function lazyRepo(app: FirebaseApp): RemoteRepo {
  const real = import('../services/persistence/firestoreRepo').then((m) => m.createFirestoreRepo(m.getDb(app)))
  return {
    load: async (uid) => (await real).load(uid),
    putWatch: async (uid, e) => (await real).putWatch(uid, e),
    deleteWatch: async (uid, id) => (await real).deleteWatch(uid, id),
    putPreferences: async (uid, p) => (await real).putPreferences(uid, p),
    putSession: async (uid, r) => (await real).putSession(uid, r),
    deleteAll: async (uid) => (await real).deleteAll(uid),
  }
}

/** The app's one account store. Without Firebase config it is a device-only guest. */
export function getAppAccountStore(): AccountStore {
  if (!appStore) {
    const { services } = getFirebase()
    appStore = createAccountStore({
      auth: services ? lazyAuth(services.app) : null,
      repo: services ? lazyRepo(services.app) : null,
      stores: { watchlist: watchlistStore, preferences: preferencesStore, sessions: sessionHistoryStore },
    })
  }
  return appStore
}

export function useAccount(store: AccountStore = getAppAccountStore()) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return { state, store }
}

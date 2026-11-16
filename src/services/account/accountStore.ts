import type { AuthAdapter, AuthUser } from '../firebase/auth'
import { explainAuthError } from '../firebase/authErrors'
import { startCloudSync, type SyncStatus, type SyncStores } from '../persistence/cloudSync'
import type { RemoteRepo } from '../persistence/remoteRepo'
import { DEMO_PROFILE } from '../../data/demoProfile'

/**
 * Who is using NYSUS and where their data lives.
 *
 *  - Guest (the default, no sign-up): data is kept in this browser. When the Firebase
 *    project allows anonymous sign-in, the guest also gets a private Firestore space, so
 *    the demo shows real persistence without anyone creating an account.
 *  - Google: the guest's data moves into the Google account (same uid when linking) and
 *    follows the viewer to other devices.
 */
export type AccountKind = 'guest' | 'google'

/**
 * Where data is saved: 'device' (this browser only), or a cloud SyncStatus.
 * 'unavailable' means Firebase isn't configured at all.
 */
export type Storage = 'unavailable' | 'device' | SyncStatus

export interface AccountState {
  /** 'starting' until Firebase Auth reports whether someone is signed in. */
  phase: 'starting' | 'ready'
  kind: AccountKind
  user: AuthUser | null
  storage: Storage
  /** Why data is device-only, or the last sync error. */
  storageNote: string | null
  /** True while a sign-in, sign-out or delete is running. */
  busy: boolean
  /** Last sign-in / sign-out error, for the account menu. */
  error: string | null
  canSignIn: boolean
}

export interface AccountDeps {
  auth: AuthAdapter | null
  repo: RemoteRepo | null
  stores: SyncStores
}

export function createAccountStore({ auth, repo, stores }: AccountDeps) {
  let state: AccountState = {
    phase: auth ? 'starting' : 'ready',
    kind: 'guest',
    user: null,
    storage: auth ? 'device' : 'unavailable',
    storageNote: auth ? null : 'Firebase is not configured, so everything stays in this browser.',
    busy: false,
    error: null,
    canSignIn: !!auth,
  }
  const listeners = new Set<() => void>()
  let sync: ReturnType<typeof startCloudSync> | null = null
  let syncedUid: string | null = null
  /** Set while signing out, so the next "no user" doesn't immediately create a guest from stale data. */
  let guestAttempted = false

  const set = (patch: Partial<AccountState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }

  function attach(user: AuthUser | null) {
    if (user?.uid === syncedUid) return
    sync?.stop()
    sync = null
    syncedUid = user?.uid ?? null
    if (!user || !repo) return
    sync = startCloudSync(user.uid, repo, stores, (s, err) => {
      if (syncedUid !== user.uid) return
      set({ storage: s, storageNote: s === 'error' ? `Couldn't save to the cloud: ${err ?? 'unknown error'}. Changes are kept in this browser.` : null })
    })
  }

  function setUser(user: AuthUser | null) {
    set({ phase: 'ready', user, kind: user && !user.isAnonymous ? 'google' : 'guest' })
    attach(user)
  }

  async function startGuest() {
    if (!auth || guestAttempted) return
    guestAttempted = true
    try {
      await auth.signInAsGuest() // onUserChanged delivers the user
    } catch (err) {
      set({
        phase: 'ready',
        storage: 'device',
        storageNote: `Saved in this browser only. ${/not enabled/.test(explainAuthError(err)) ? 'Anonymous sign-in is not enabled for this Firebase project.' : explainAuthError(err)}`,
      })
    }
  }

  if (auth) {
    auth.onUserChanged((user) => {
      if (user) setUser(user)
      else {
        setUser(null)
        set({ storage: 'device' })
        void startGuest()
      }
    })
    void auth.completeRedirect().then(
      (u) => u && setUser(u),
      (err: unknown) => set({ error: explainAuthError(err) }),
    )
  }

  function clearLocal() {
    stores.watchlist.clear()
    stores.preferences.clear()
    stores.sessions.clear()
  }

  return {
    getSnapshot: () => state,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },

    async signInWithGoogle() {
      if (!auth || state.busy) return
      set({ busy: true, error: null })
      try {
        const user = await auth.signInWithGoogle()
        if (user !== 'redirecting') setUser(user)
      } catch (err) {
        set({ error: explainAuthError(err) })
      } finally {
        set({ busy: false })
      }
    },

    /** Signs out of Google. This browser's copy is cleared; the account keeps everything. */
    async signOut() {
      if (!auth || state.busy || state.kind !== 'google') return
      set({ busy: true, error: null })
      try {
        attach(null)
        clearLocal()
        guestAttempted = false
        await auth.signOut()
      } catch (err) {
        set({ error: explainAuthError(err) })
      } finally {
        set({ busy: false })
      }
    },

    /** Deletes the viewer's saved data here and, when there is one, in their cloud space. */
    async deleteMyData() {
      if (state.busy) return
      set({ busy: true, error: null })
      try {
        const uid = syncedUid
        attach(null)
        clearLocal()
        if (uid && repo) await repo.deleteAll(uid)
        if (state.user) attach(state.user)
      } catch (err) {
        set({ error: `Couldn't delete cloud data: ${err instanceof Error ? err.message : String(err)}` })
        if (state.user) attach(state.user)
      } finally {
        set({ busy: false })
      }
    },

    /** Fills the watchlist with a ready-made taste profile, so recommendations are personal straight away. */
    loadDemoProfile() {
      for (const { id, watched } of [...DEMO_PROFILE].reverse()) {
        if (watched) stores.watchlist.setWatched(id, true)
        else stores.watchlist.add(id)
      }
    },
  }
}

export type AccountStore = ReturnType<typeof createAccountStore>

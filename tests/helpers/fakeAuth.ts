import { vi } from 'vitest'
import type { AuthAdapter, AuthUser } from '../../src/services/firebase/auth'

/** Scriptable Firebase Auth: anonymous guests, Google linking, an existing Google account. */
export function fakeAuth(opts: { anonymousEnabled?: boolean; existingGoogleUid?: string; startSignedIn?: AuthUser } = {}) {
  let current: AuthUser | null = opts.startSignedIn ?? null
  let cb: ((u: AuthUser | null) => void) | null = null
  let anonCount = 0
  const emit = () => cb?.(current)
  const adapter: AuthAdapter = {
    onUserChanged(fn) {
      cb = fn
      queueMicrotask(emit)
      return () => (cb = null)
    },
    signInAsGuest: vi.fn(async () => {
      if (opts.anonymousEnabled === false) throw Object.assign(new Error('admin restricted'), { code: 'auth/admin-restricted-operation' })
      current = { uid: `anon${++anonCount}`, isAnonymous: true, displayName: null, photoURL: null }
      queueMicrotask(emit)
      return current
    }),
    signInWithGoogle: vi.fn(async () => {
      const google = { isAnonymous: false, displayName: 'Dana', photoURL: null }
      if (opts.existingGoogleUid) {
        // Google account already has data: sign in to it (a different uid).
        current = { uid: opts.existingGoogleUid, ...google }
        queueMicrotask(emit)
      } else if (current?.isAnonymous) {
        current = { ...current, ...google } // linked: same uid, no auth-state event
      } else {
        current = { uid: 'google1', ...google }
        queueMicrotask(emit)
      }
      return current
    }),
    signOut: vi.fn(async () => {
      current = null
      queueMicrotask(emit)
    }),
    completeRedirect: vi.fn(async () => null),
  }
  return { adapter, current: () => current }
}

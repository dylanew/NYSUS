import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import type { FirebaseApp } from 'firebase/app'

/** Just what the app shows. The email address is deliberately not read. */
export interface AuthUser {
  uid: string
  isAnonymous: boolean
  displayName: string | null
  photoURL: string | null
}

/** The app's view of Firebase Authentication; tests swap in a fake. */
export interface AuthAdapter {
  onUserChanged(cb: (user: AuthUser | null) => void): () => void
  signInAsGuest(): Promise<AuthUser>
  /** Upgrades a guest to Google, keeping its data; signs in to the existing account if that Google account already has one. */
  signInWithGoogle(): Promise<AuthUser | 'redirecting'>
  signOut(): Promise<void>
  /** Completes a sign-in that had to fall back to a full-page redirect. */
  completeRedirect(): Promise<AuthUser | null>
}

export const toAuthUser = (u: User): AuthUser => ({ uid: u.uid, isAnonymous: u.isAnonymous, displayName: u.displayName, photoURL: u.photoURL })

import { authErrorCode as code } from './authErrors'

export function createFirebaseAuthAdapter(app: FirebaseApp): AuthAdapter {
  const auth: Auth = getAuth(app)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  async function existingAccount(err: unknown): Promise<AuthUser> {
    const credential = GoogleAuthProvider.credentialFromError(err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0])
    if (!credential) throw err
    return toAuthUser((await signInWithCredential(auth, credential)).user)
  }

  return {
    onUserChanged: (cb) => onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null)),
    signInAsGuest: async () => toAuthUser((await signInAnonymously(auth)).user),
    async signInWithGoogle() {
      const current = auth.currentUser
      try {
        if (current?.isAnonymous) {
          const result = await linkWithPopup(current, provider)
          // Linking keeps the uid, so onAuthStateChanged does not fire; reload for the new profile.
          await result.user.reload()
          return toAuthUser(auth.currentUser ?? result.user)
        }
        return toAuthUser((await signInWithPopup(auth, provider)).user)
      } catch (err) {
        if (code(err) === 'auth/credential-already-in-use') return existingAccount(err)
        if (code(err) === 'auth/popup-blocked') {
          if (current?.isAnonymous) await linkWithRedirect(current, provider)
          else await signInWithRedirect(auth, provider)
          return 'redirecting'
        }
        throw err
      }
    },
    signOut: () => signOut(auth),
    async completeRedirect() {
      try {
        const result = await getRedirectResult(auth)
        return result ? toAuthUser(result.user) : null
      } catch (err) {
        if (code(err) === 'auth/credential-already-in-use') return existingAccount(err)
        throw err
      }
    },
  }
}

export { explainAuthError } from './authErrors'

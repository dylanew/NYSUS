/** Kept apart from auth.ts so the app can word errors without loading the Auth SDK. */
export const authErrorCode = (err: unknown) => (typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '')

/** Human wording for the auth errors a viewer can actually hit. */
export function explainAuthError(err: unknown): string {
  switch (authErrorCode(err)) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'Sign-in was cancelled.'
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'This sign-in method is not enabled for the Firebase project (Authentication → Sign-in method).'
    case 'auth/unauthorized-domain':
      return 'This site is not an authorised domain for sign-in (Authentication → Settings → Authorised domains).'
    case 'auth/network-request-failed':
      return 'Could not reach Firebase. Check your connection and try again.'
    case 'auth/popup-blocked':
      return 'The browser blocked the sign-in window. Allow pop-ups for this site and try again.'
    default:
      return err instanceof Error ? err.message : 'Sign-in failed.'
  }
}

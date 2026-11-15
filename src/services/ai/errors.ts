/** Browser-level fetch failures (Safari: "Type error"/"Load failed", Chrome: "Failed to fetch") never reached Firebase. */
export function explainError(message: string): string {
  if (/Error fetching from/.test(message) && /type ?error|load failed|failed to fetch|network/i.test(message)) {
    return `${message}. The browser blocked or dropped the request before Firebase answered (content blocker, privacy relay, VPN or offline).`
  }
  if (/App Check token is invalid/i.test(message)) {
    return `${message}. Register this browser's App Check debug token in the Firebase console.`
  }
  return message
}

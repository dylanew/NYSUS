/** Browser-level fetch failures (Safari: "Type error"/"Load failed", Chrome: "Failed to fetch") never reached Firebase. */
export function explainError(message: string): string {
  if (/Error fetching from/.test(message) && /type ?error|load failed|failed to fetch|network/i.test(message)) {
    return `${message}. The browser blocked or dropped the request before Firebase answered (content blocker, privacy relay, VPN or offline).`
  }
  if (/App Check token is invalid/i.test(message)) {
    return `${message}. This browser has no valid App Check token. Use Settings → Test App Check to see why.`
  }
  return message
}

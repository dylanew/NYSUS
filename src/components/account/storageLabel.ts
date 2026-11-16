import type { AccountState } from '../../services/account/accountStore'

export type StorageTone = 'ok' | 'busy' | 'local' | 'error'

/** One line on where the viewer's watchlist, preferences and sessions are being saved. */
export function describeStorage(s: AccountState): { text: string; tone: StorageTone } {
  if (s.phase === 'starting') return { text: 'Checking your account…', tone: 'busy' }
  switch (s.storage) {
    case 'unavailable':
    case 'device':
      return { text: 'Saved in this browser', tone: 'local' }
    case 'connecting':
      return { text: 'Connecting to your saved data…', tone: 'busy' }
    case 'saving':
      return { text: 'Saving…', tone: 'busy' }
    case 'synced':
      return { text: s.kind === 'google' ? 'Synced to your Google account' : 'Saved to a private guest space in the cloud', tone: 'ok' }
    case 'error':
      return { text: 'Not saved to the cloud, kept in this browser', tone: 'error' }
  }
}

export const TONE_CLASS: Record<StorageTone, string> = {
  ok: 'bg-local',
  busy: 'bg-butter animate-pulse',
  local: 'bg-ink-500',
  error: 'bg-danger',
}

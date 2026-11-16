import { getAppAccountStore } from '../hooks/useAccount'
import { playerStore } from '../services/playback/playerStore'
import { recordSessions, sessionHistoryStore } from '../services/playback/sessionHistory'

/**
 * Starts the app-wide services that run regardless of the page: the account (guest or
 * signed in, plus cloud sync) and the recorder that saves playback sessions.
 */
export function startBackgroundServices() {
  getAppAccountStore()
  const recorder = recordSessions(playerStore, sessionHistoryStore)
  // Save the session in progress when the tab is hidden or closed.
  const onHide = () => {
    if (document.visibilityState === 'hidden') recorder.flush()
  }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', recorder.flush)
}

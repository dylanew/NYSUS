import type { MediaTitle } from '../../types/media'
import type { PlaybackSession, QualityId, ScenarioId } from '../../types/playback'
import type { QualityMode } from '../playback/engine'

/**
 * Everything the assistant's tools are allowed to read. Tools get this object and nothing
 * else: no Firestore handle, no fetch, no access to the player's controls. That is the
 * "no unrestricted data access" boundary from the spec, enforced by the type.
 */
export interface ToolContext {
  getSession(): PlaybackSession | null
  getPlayback(): {
    scenario: ScenarioId
    quality: QualityId
    qualityMode: QualityMode
    /** Name of the service whose website latency is measured in live mode. */
    liveServiceLabel: string
  }
  getWatchlist(): { title: MediaTitle; watched: boolean }[]
  titles: MediaTitle[]
  currentYear: number
}

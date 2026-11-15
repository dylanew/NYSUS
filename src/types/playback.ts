export type PlaybackEventType =
  | 'play'
  | 'pause'
  | 'buffer_start'
  | 'buffer_end'
  | 'quality_change'
  | 'network_change'
  | 'playback_error'
  | 'ended'
  /** Periodic measurement (every 2 s of simulated time) used for averages and charts. */
  | 'telemetry_sample'

export interface PlaybackEvent {
  /** Stable, human-quotable id, e.g. "s1-e42". */
  id: string
  sessionId: string
  /** Milliseconds since the session started (simulated clock). */
  timestamp: number
  type: PlaybackEventType
  bitrateKbps?: number
  throughputMbps?: number
  latencyMs?: number
  quality?: QualityId
  /** For quality_change: the previous quality. */
  fromQuality?: QualityId
  /** For buffer_end: how long playback was stalled. */
  durationMs?: number
  bufferSeconds?: number
  scenario?: ScenarioId
  details?: string
}

export type PlaybackStatus = 'playing' | 'paused' | 'buffering' | 'ended' | 'error'

export interface PlaybackSession {
  id: string
  titleId: string
  /** Wall-clock start (ms since epoch), for display only; event timestamps are relative. */
  startedAt: number
  /** Simulated milliseconds elapsed when the session was last updated. */
  elapsedMs: number
  endedAt?: number
  status: PlaybackStatus
  events: PlaybackEvent[]
}

export type QualityId = '2160p' | '1080p' | '720p' | '480p' | '360p'
export type ScenarioId = 'stable' | 'unstable' | 'poor' | 'interruption'

export interface NetworkSample {
  throughputMbps: number
  latencyMs: number
}

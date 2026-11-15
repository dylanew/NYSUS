import type { PlaybackEvent, PlaybackStatus } from '../../types/playback'

export const STATUS_LABEL: Record<PlaybackStatus | 'idle', string> = {
  idle: 'Ready',
  playing: 'Playing',
  paused: 'Paused',
  buffering: 'Buffering',
  ended: 'Ended',
  error: 'Playback error',
}

export function describeEvent(e: PlaybackEvent): string {
  switch (e.type) {
    case 'play': return e.details ?? `Playback started at ${e.quality}`
    case 'pause': return 'Paused'
    case 'buffer_start': return `Buffering started (${e.throughputMbps} Mbps available, ${e.quality} needs ${(e.bitrateKbps ?? 0) / 1000} Mbps)`
    case 'buffer_end': return `Buffering ended after ${((e.durationMs ?? 0) / 1000).toFixed(0)} s${e.details ? ` · ${e.details}` : ''}`
    case 'quality_change': return `Quality ${e.fromQuality} → ${e.quality}${e.details ? ` · ${e.details}` : ''}`
    case 'network_change': return e.details ?? 'Network changed'
    case 'playback_error': return `Error: ${e.details ?? 'playback failed'}`
    case 'ended': return 'Playback finished'
    case 'telemetry_sample': return `${e.throughputMbps} Mbps · ${e.bitrateKbps} kbps · buffer ${e.bufferSeconds} s`
  }
}

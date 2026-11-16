import { THEME } from '../../theme/tokens'
import type { PlaybackSession } from '../../types/playback'

/**
 * Series colours on the warm ink-900 chart surface. Throughput (blue) and bitrate (butter) are
 * paired on one chart, so they differ in hue and lightness and stay distinct with red-green colour blindness.
 */
export const SERIES = { throughput: '#4b9cf0', bitrate: THEME.butter, buffer: '#2fb383' } as const

export interface ChartPoint {
  t: number
  throughput: number
  bitrate: number
  buffer: number
}

export function toChartPoints(session: PlaybackSession): ChartPoint[] {
  return session.events
    .filter((e) => e.type === 'telemetry_sample')
    .map((e) => ({ t: e.timestamp / 1000, throughput: e.throughputMbps ?? 0, bitrate: (e.bitrateKbps ?? 0) / 1000, buffer: e.bufferSeconds ?? 0 }))
}


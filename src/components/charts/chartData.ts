import type { PlaybackSession } from '../../types/playback'

/** Validated with the dataviz palette checker against the #111115 chart surface (dark). */
export const SERIES = { throughput: '#199e70', bitrate: '#9085e9', buffer: '#3987e5' } as const

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


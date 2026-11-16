import type { PlaybackEvent, PlaybackSession } from '../../types/playback'

export interface BufferingIncident {
  startEventId: string
  endEventId: string | null
  startMs: number
  durationMs: number | null
  quality?: string
  bitrateKbps?: number
  /** Throughput measured when the stall began. */
  throughputAtStartMbps?: number
  /** Mean throughput over telemetry samples in the 10 s before the stall. */
  throughputBeforeMbps: number | null
  latencyAtStartMs?: number
  /** Observations only. Correlation, not proof of cause. */
  contributingFactors: string[]
  /** Other events within 10 s before the stall (network or quality changes). */
  relatedEventIds: string[]
}

const LOOKBACK_MS = 10_000

/** Pairs buffer_start/buffer_end events and records the conditions around each one. */
export function analyseBuffering(session: PlaybackSession): BufferingIncident[] {
  const ev = session.events
  const incidents: BufferingIncident[] = []
  ev.forEach((e, i) => {
    if (e.type !== 'buffer_start') return
    const end = ev.slice(i + 1).find((x) => x.type === 'buffer_end')
    const window = ev.filter((x) => x.timestamp >= e.timestamp - LOOKBACK_MS && x.timestamp <= e.timestamp)
    const samples = window.filter((x) => x.type === 'telemetry_sample' && x.throughputMbps !== undefined)
    const before = samples.length ? samples.reduce((s, x) => s + x.throughputMbps!, 0) / samples.length : null
    const related = window.filter((x) => x.type === 'network_change' || x.type === 'quality_change').map((x) => x.id)

    incidents.push({
      startEventId: e.id,
      endEventId: end?.id ?? null,
      startMs: e.timestamp,
      durationMs: end?.durationMs ?? null,
      quality: e.quality,
      bitrateKbps: e.bitrateKbps,
      throughputAtStartMbps: e.throughputMbps,
      throughputBeforeMbps: before === null ? null : Math.round(before * 100) / 100,
      latencyAtStartMs: e.latencyMs,
      contributingFactors: factors(e, before, related, ev),
      relatedEventIds: related,
    })
  })
  return incidents
}

function factors(start: PlaybackEvent, before: number | null, related: string[], all: PlaybackEvent[]): string[] {
  const out: string[] = []
  const bitrateMbps = (start.bitrateKbps ?? 0) / 1000
  if (start.throughputMbps === 0) out.push('No data was being received (connection offline) when the stall began.')
  else if (start.throughputMbps !== undefined && start.throughputMbps < bitrateMbps)
    out.push(`Throughput at the stall (${start.throughputMbps} Mbps) was below the video bitrate (${bitrateMbps} Mbps).`)
  if (before !== null && before < bitrateMbps) out.push(`Average throughput in the 10 s before (${before.toFixed(2)} Mbps) was below the video bitrate.`)
  if ((start.latencyMs ?? 0) >= 150) out.push(`Latency was high (${start.latencyMs} ms).`)
  const ups = related.map((id) => all.find((x) => x.id === id)).filter((x) => x?.type === 'quality_change' && x.fromQuality && x.quality && rank(x.quality) > rank(x.fromQuality))
  if (ups.length) out.push('Quality had been raised shortly before the stall.')
  return out
}

const ORDER = ['360p', '480p', '720p', '1080p', '2160p']
const rank = (q: string) => ORDER.indexOf(q)

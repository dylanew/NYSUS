import type { PlaybackMetrics } from '../../services/playback/metrics'
import { formatClock } from '../../services/playback/metrics'

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
      <dt className="text-xs uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink-100">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

export function MetricTiles({ metrics }: { metrics: PlaybackMetrics }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Buffering" value={`${metrics.bufferingRatioPct}%`} hint={`${metrics.bufferingEvents} stalls · ${formatClock(metrics.bufferingMs)} of ${formatClock(metrics.observedMs)}`} />
      <Tile label="Avg throughput" value={metrics.averageThroughputMbps === null ? '—' : `${metrics.averageThroughputMbps} Mbps`} hint="Network speed available" />
      <Tile label="Avg bitrate" value={metrics.averageBitrateKbps === null ? '—' : `${(metrics.averageBitrateKbps / 1000).toFixed(2)} Mbps`} hint="Video quality being streamed" />
      <Tile label="Errors · quality changes" value={`${metrics.errorCount} · ${metrics.qualityChanges.length}`} hint={`${metrics.bufferingPerMinute} stalls per minute`} />
    </dl>
  )
}

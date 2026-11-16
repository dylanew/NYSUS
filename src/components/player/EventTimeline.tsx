import type { PlaybackEvent } from '../../types/playback'
import { formatClock } from '../../services/playback/metrics'
import { describeEvent } from './labels'

const DOT: Partial<Record<PlaybackEvent['type'], string>> = {
  buffer_start: 'bg-warn',
  buffer_end: 'bg-ink-500',
  playback_error: 'bg-danger',
  quality_change: 'bg-accent-400',
  network_change: 'bg-cloud',
  play: 'bg-local',
}

export function EventTimeline({ events, limit = 12 }: { events: PlaybackEvent[]; limit?: number }) {
  const shown = events.filter((e) => e.type !== 'telemetry_sample').slice(-limit).reverse()
  if (shown.length === 0) return <p className="text-sm text-ink-500">No events yet. Press play.</p>
  return (
    <ol className="space-y-1.5" aria-label="Playback events">
      {shown.map((e) => (
        <li key={e.id} className="flex items-start gap-3 text-sm">
          <span className="w-10 shrink-0 tabular-nums text-ink-500">{formatClock(e.timestamp)}</span>
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[e.type] ?? 'bg-ink-700'}`} aria-hidden />
          <span className="min-w-0 flex-1 text-ink-300">{describeEvent(e)}</span>
          <code className="shrink-0 text-[10px] text-ink-500">{e.id}</code>
        </li>
      ))}
    </ol>
  )
}

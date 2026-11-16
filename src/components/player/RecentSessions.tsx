import { Link } from 'react-router'
import { History } from 'lucide-react'
import { useStore } from '../../hooks/useStore'
import { getTitle } from '../../services/catalogue/catalogue'
import { formatClock } from '../../services/playback/metrics'
import { sessionHistoryStore, type SessionHistoryStore } from '../../services/playback/sessionHistory'
import { getScenario } from '../../data/demoScenarios'
import { STATUS_LABEL } from './labels'

const when = (t: number) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(t)

/** Saved playback sessions, newest first: "continue watching" plus how each stream held up. */
export function RecentSessions({ store = sessionHistoryStore, limit = 4 }: { store?: SessionHistoryStore; limit?: number }) {
  const records = useStore(store).slice(0, limit)
  if (records.length === 0) {
    return (
      <p className="text-sm text-ink-500">
        Nothing watched yet. Sessions you play in the <Link to="/player" className="text-accent-300 underline">Player</Link> are saved here with how the stream held up.
      </p>
    )
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {records.map((r) => {
        const title = getTitle(r.titleId)
        const healthy = r.metrics.bufferingEvents === 0 && r.metrics.errorCount === 0
        return (
          <li key={r.id}>
            <Link
              to={`/player?title=${encodeURIComponent(r.titleId)}`}
              className="flex h-full items-start gap-3 rounded-xl border border-ink-800 bg-ink-900 p-4 hover:border-ink-700"
            >
              <History className="mt-0.5 size-4 shrink-0 text-accent-400" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{title?.title ?? r.titleId}</span>
                <span className="block text-xs text-ink-500">
                  {when(r.startedAt)} · {formatClock(r.elapsedMs)} watched · {STATUS_LABEL[r.status]}
                </span>
                <span className="mt-1 block text-xs text-ink-300">
                  {r.scenarios.map((s) => getScenario(s).label).join(', ') || 'Unknown network'} ·{' '}
                  <span className={healthy ? 'text-local' : 'text-warn'}>
                    {healthy ? 'no stalls' : `${r.metrics.bufferingRatioPct}% buffering, ${r.metrics.bufferingEvents} stall${r.metrics.bufferingEvents === 1 ? '' : 's'}${r.metrics.errorCount ? `, ${r.metrics.errorCount} error${r.metrics.errorCount === 1 ? '' : 's'}` : ''}`}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

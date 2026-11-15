import { BookmarkCheck, BookmarkPlus } from 'lucide-react'
import { useWatchlist } from '../../hooks/useWatchlist'

export function WatchlistButton({ titleId, compact = false }: { titleId: string; compact?: boolean }) {
  const { has, add, remove } = useWatchlist()
  const saved = has(titleId)
  const Icon = saved ? BookmarkCheck : BookmarkPlus
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => (saved ? remove(titleId) : add(titleId))}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
        saved ? 'border-accent-500/50 bg-accent-500/15 text-accent-300' : 'border-ink-700 text-ink-300 hover:border-ink-500 hover:text-ink-100'
      }`}
    >
      <Icon className="size-3.5" aria-hidden />
      {compact ? null : saved ? 'In watchlist' : 'Add to watchlist'}
      {compact && <span className="sr-only">{saved ? 'Remove from watchlist' : 'Add to watchlist'}</span>}
    </button>
  )
}

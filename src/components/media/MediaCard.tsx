import { Link } from 'react-router'
import type { MediaTitle } from '../../types/media'
import { formatDuration } from '../../services/catalogue/catalogue'
import { Artwork } from './Artwork'
import { WatchlistButton } from './WatchlistButton'

export function MediaCard({ title, explanation, score }: { title: MediaTitle; explanation?: string; score?: number }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-900 transition-colors hover:border-ink-700">
      <Link to={`/title/${title.id}`} className="block">
        <Artwork title={title} className="aspect-[16/10] transition-transform duration-300 group-hover:scale-[1.02]" />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/title/${title.id}`} className="font-medium text-ink-100 hover:text-accent-300">
              {title.title}
            </Link>
            <p className="text-xs text-ink-500">
              {title.year} · {formatDuration(title)}
            </p>
          </div>
          {score !== undefined && (
            <span className="shrink-0 rounded-md bg-ink-800 px-1.5 py-0.5 text-xs tabular-nums text-ink-300" title="Match score">
              {Math.round(score * 100)}%
            </span>
          )}
        </div>
        <p className="text-xs text-ink-500">{title.genres.join(' · ')}</p>
        {explanation && <p className="text-sm text-ink-300">{explanation}</p>}
        <div className="mt-auto pt-1">
          <WatchlistButton titleId={title.id} />
        </div>
      </div>
    </article>
  )
}

export function MediaGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

import { Link } from 'react-router'
import { getTitle } from '../../services/catalogue/catalogue'
import type { searchCatalogue } from '../../services/assistant/tools'
import { Artwork } from '../media/Artwork'
import { WatchlistButton } from '../media/WatchlistButton'

type SearchResult = ReturnType<typeof searchCatalogue>

/** Titles exactly as search_catalogue returned them; the model cannot add titles here. */
export function RecommendationStrip({ result }: { result: SearchResult }) {
  const items = result.results.map((r) => ({ r, title: getTitle(r.id) })).filter((x) => x.title)
  if (items.length === 0) return null
  return (
    <section aria-label="Recommended titles" className="space-y-2">
      <h3 className="text-xs uppercase tracking-wider text-ink-500">From the catalogue</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map(({ r, title }) => (
          <li key={r.id} className="flex gap-3 rounded-lg border border-ink-800 bg-ink-950/60 p-2">
            <Link to={`/title/${r.id}`} className="w-20 shrink-0 overflow-hidden rounded-md">
              <Artwork title={title!} className="aspect-[16/10]" showLabels={false} />
            </Link>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <Link to={`/title/${r.id}`} className="truncate text-sm font-medium hover:text-accent-300">{r.title}</Link>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-500" title="Match score from the app's ranking">{r.demoScore}%</span>
              </div>
              <p className="line-clamp-2 text-xs text-ink-300">{r.explanation}</p>
              <WatchlistButton titleId={r.id} compact />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

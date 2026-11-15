import { Link } from 'react-router'
import { Check, Trash2 } from 'lucide-react'
import { Artwork } from '../components/media/Artwork'
import { useWatchlist } from '../hooks/useWatchlist'
import { formatDuration } from '../services/catalogue/catalogue'

export function WatchlistPage() {
  const { items, remove, setWatched } = useWatchlist()
  const toWatch = items.filter((i) => !i.watched)
  const watched = items.filter((i) => i.watched)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold md:text-3xl">Watchlist</h1>
        <p className="mt-1 text-sm text-ink-500">Saved on this device. What you save and watch shapes "Recommended for you".</p>
      </header>
      {items.length === 0 ? (
        <p className="text-ink-300">
          Nothing saved yet. <Link to="/discover" className="text-accent-300 underline">Find something to watch</Link>.
        </p>
      ) : (
        <>
          <List heading={`To watch (${toWatch.length})`} items={toWatch} onRemove={remove} onToggle={(id) => setWatched(id, true)} toggleLabel="Mark watched" />
          {watched.length > 0 && (
            <List heading={`Watched (${watched.length})`} items={watched} onRemove={remove} onToggle={(id) => setWatched(id, false)} toggleLabel="Mark unwatched" />
          )}
        </>
      )}
    </div>
  )
}

function List(props: {
  heading: string
  items: ReturnType<typeof useWatchlist>['items']
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  toggleLabel: string
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-500">{props.heading}</h2>
      <ul className="divide-y divide-ink-800 rounded-xl border border-ink-800">
        {props.items.map(({ title, watched }) => (
          <li key={title.id} className="flex items-center gap-4 p-3">
            <Artwork title={title} className="hidden aspect-[16/10] w-28 shrink-0 rounded-md text-xs sm:block [&>span:first-of-type]:hidden" />
            <div className="min-w-0 flex-1">
              <Link to={`/title/${title.id}`} className={`font-medium hover:text-accent-300 ${watched ? 'text-ink-300' : 'text-ink-100'}`}>
                {title.title}
              </Link>
              <p className="text-xs text-ink-500">
                {title.year} · {formatDuration(title)}
              </p>
            </div>
            <button type="button" onClick={() => props.onToggle(title.id)} className="inline-flex items-center gap-1 rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:text-ink-100">
              <Check className="size-3.5" aria-hidden /> {props.toggleLabel}
            </button>
            <button type="button" onClick={() => props.onRemove(title.id)} aria-label={`Remove ${title.title}`} className="rounded-md p-1.5 text-ink-500 hover:text-danger">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

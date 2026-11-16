import { Link } from 'react-router'
import { Check, Trash2 } from 'lucide-react'
import { Artwork } from '../components/media/Artwork'
import { useWatchlist } from '../hooks/useWatchlist'
import { formatDuration } from '../services/catalogue/catalogue'
import { TasteSummary } from '../components/media/TasteSummary'
import { useAccount } from '../hooks/useAccount'
import { describeStorage, TONE_CLASS } from '../components/account/storageLabel'

export function WatchlistPage() {
  const { items, profile, remove, setWatched } = useWatchlist()
  const { state: account, store: accountStore } = useAccount()
  const storage = describeStorage(account)
  const toWatch = items.filter((i) => !i.watched)
  const watched = items.filter((i) => i.watched)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold md:text-3xl">Watchlist</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${TONE_CLASS[storage.tone]}`} aria-hidden />
            {storage.text}.
          </span>
          <span>What you save and watch shapes "Recommended for you".</span>
        </p>
      </header>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 p-8 text-center">
          <p className="text-ink-300">Nothing saved yet.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link to="/discover" className="rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-medium text-cream hover:bg-accent-600">
              Find something to watch
            </Link>
            {account.kind === 'guest' && (
              <button type="button" onClick={() => accountStore.loadDemoProfile()} className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-100 hover:border-ink-500">
                Load demo profile
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <List demo={account.demoTitleIds} heading={`To watch (${toWatch.length})`} items={toWatch} onRemove={remove} onToggle={(id) => setWatched(id, true)} toggleLabel="Mark watched" />
          {watched.length > 0 && (
            <List demo={account.demoTitleIds} heading={`Watched (${watched.length})`} items={watched} onRemove={remove} onToggle={(id) => setWatched(id, false)} toggleLabel="Mark unwatched" />
          )}
        </>
      )}
      <TasteSummary profile={profile} />
    </div>
  )
}

function List(props: {
  demo: string[]
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
                {props.demo.includes(title.id) && (
                  <span className="ml-2 rounded border border-butter/40 px-1.5 py-px text-[10px] uppercase tracking-wider text-butter" title="From the demo profile. Stays in guest mode.">
                    Demo
                  </span>
                )}
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

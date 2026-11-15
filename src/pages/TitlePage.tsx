import { Link, useParams } from 'react-router'
import { Check, PlayCircle } from 'lucide-react'
import { Artwork } from '../components/media/Artwork'
import { MediaCard, MediaGrid } from '../components/media/MediaCard'
import { WatchlistButton } from '../components/media/WatchlistButton'
import { useWatchlist } from '../hooks/useWatchlist'
import { allTitles, formatDuration, getTitle } from '../services/catalogue/catalogue'
import { rankTitles } from '../services/recommendations/ranking'

export function TitlePage() {
  const { id = '' } = useParams()
  const title = getTitle(id)
  const { isWatched, setWatched } = useWatchlist()
  if (!title) return <p className="text-ink-300">That title isn't in the catalogue. <Link to="/discover" className="underline">Back to Discover</Link></p>

  const similar = rankTitles(
    allTitles(),
    { preferences: { genres: [], moods: [], preferredThemes: [], excludeGenres: [], contentType: 'any', length: 'any', confidence: 1 }, reference: title },
    3,
  )
  const watched = isWatched(title.id)

  return (
    <article className="space-y-10">
      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Artwork title={title} className="aspect-[16/10] rounded-2xl" />
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold">{title.title}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {title.type === 'film' ? 'Film' : 'Series'} · {title.year} · {formatDuration(title)}
            </p>
          </div>
          <p className="text-ink-300">{title.description}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-500">Genres</dt><dd>{title.genres.join(', ')}</dd>
            <dt className="text-ink-500">Mood</dt><dd>{title.moods.join(', ')}</dd>
            <dt className="text-ink-500">Themes</dt><dd>{title.themes.join(', ')}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link to={`/player?title=${title.id}`} className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-500">
              <PlayCircle className="size-4" aria-hidden /> Watch (simulated)
            </Link>
            <WatchlistButton titleId={title.id} />
            <button type="button" onClick={() => setWatched(title.id, !watched)} aria-pressed={watched} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-ink-300 hover:text-ink-100">
              <Check className="size-3.5" aria-hidden /> {watched ? 'Watched' : 'Mark watched'}
            </button>
          </div>
        </div>
      </div>
      {similar.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium">More like this</h2>
          <MediaGrid>
            {similar.map((r) => (
              <MediaCard key={r.title.id} title={r.title} explanation={r.explanation} />
            ))}
          </MediaGrid>
        </section>
      )}
    </article>
  )
}

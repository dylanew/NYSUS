import { Link, useNavigate } from 'react-router'
import { MessageSquare } from 'lucide-react'
import { DiscoveryForm } from '../components/ai/DiscoveryForm'
import { MediaCard, MediaGrid } from '../components/media/MediaCard'
import { useAiDeps } from '../hooks/useAiDeps'
import { useWatchlist } from '../hooks/useWatchlist'
import { allTitles, getTitle } from '../services/catalogue/catalogue'
import { rankTitles } from '../services/recommendations/ranking'
import { getFirebase } from '../services/firebase/app'
import type { MediaTitle } from '../types/media'
import { GuestWelcome } from '../components/account/GuestWelcome'
import { RecentSessions } from '../components/player/RecentSessions'

const FEATURED = ['severance', 'arrival', 'parasite'].map(getTitle).filter((t): t is MediaTitle => t !== undefined)

const NO_PREFS = { genres: [], moods: [], preferredThemes: [], excludeGenres: [], contentType: 'any' as const, length: 'any' as const, confidence: 1 }

export function HomePage() {
  const { deviceModel } = useAiDeps()
  const navigate = useNavigate()
  const { items, profile } = useWatchlist()
  const { config } = getFirebase()
  const saved = new Set(items.map((i) => i.titleId))
  const recommended = profile ? rankTitles(allTitles().filter((t) => !saved.has(t.id)), { preferences: NO_PREFS, profile }, 3) : []

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Good to see you.</h1>
        <p className="mt-2 max-w-xl text-ink-300">Tell NYSUS what you feel like watching. It reads your request on this device when it can.</p>
      </section>

      <GuestWelcome />

      {!config.ok && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          {config.invalid.length > 0
            ? `Some Firebase settings contain hidden or non-ASCII characters (${config.invalid.join(', ')}). Retype them in .env.local.`
            : "Firebase isn't configured, so discovery uses keyword matching."}{' '}
          <Link to="/settings" className="underline">See Settings</Link>.
        </p>
      )}

      <DiscoveryForm
        deviceModel={deviceModel}
        onSubmit={(q, { forceCloud }) => navigate(`/discover?${new URLSearchParams({ q, ...(forceCloud ? { cloud: '1' } : {}) })}`)}
      />

      <section>
        <h2 className="mb-3 text-lg font-medium">Featured</h2>
        <MediaGrid>
          {FEATURED.map((t) => (
            <MediaCard key={t.id} title={t} />
          ))}
        </MediaGrid>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-medium">Recommended for you</h2>
        {recommended.length > 0 ? (
          <>
            <p className="mb-3 text-sm text-ink-500">Based on {items.length} saved title{items.length === 1 ? '' : 's'}.</p>
            <MediaGrid>
              {recommended.map((r) => (
                <MediaCard key={r.title.id} title={r.title} explanation={r.explanation} />
              ))}
            </MediaGrid>
          </>
        ) : (
          <p className="text-sm text-ink-500">Save or watch a few titles and recommendations will appear here.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Continue watching</h2>
        <RecentSessions />
      </section>

      <Link to="/assistant" className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-5 hover:border-ink-700">
        <MessageSquare className="size-5 text-accent-400" aria-hidden />
        <span>
          <span className="block font-medium">Streaming assistant</span>
          <span className="text-sm text-ink-500">Ask why a stream is buffering, or for something to watch. It investigates with real tools.</span>
        </span>
      </Link>
    </div>
  )
}

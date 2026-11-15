import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { DiscoveryForm } from '../components/ai/DiscoveryForm'
import { DiscoverySummary } from '../components/ai/DiscoverySummary'
import { FilterChips } from '../components/media/FilterChips'
import { MediaCard, MediaGrid } from '../components/media/MediaCard'
import { useAiDeps } from '../hooks/useAiDeps'
import { useDiscovery } from '../hooks/useDiscovery'
import { useWatchlist } from '../hooks/useWatchlist'
import { allTitles } from '../services/catalogue/catalogue'
import type { MediaTitle } from '../types/media'

const tagsIn = (key: 'genres' | 'moods') => [...new Set(allTitles().flatMap((t) => t[key]))].sort()

export function DiscoverPage() {
  const { deps, deviceModel } = useAiDeps()
  const { state, run } = useDiscovery(deps)
  const { profile } = useWatchlist()
  const [params, setParams] = useSearchParams()
  const [genres, setGenres] = useState<string[]>([])
  const [moods, setMoods] = useState<string[]>([])
  const initialQuery = params.get('q') ?? ''
  const ran = useRef(false)

  useEffect(() => {
    if (initialQuery && !ran.current) {
      ran.current = true
      void run(initialQuery, { profile, forceCloud: params.get('cloud') === '1' })
    }
  }, [initialQuery, params, profile, run])

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]))
  const passes = (t: MediaTitle) => genres.every((g) => t.genres.includes(g)) && moods.every((m) => t.moods.includes(m))

  const genreOptions = useMemo(() => tagsIn('genres'), [])
  const moodOptions = useMemo(() => tagsIn('moods'), [])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold md:text-3xl">Discover</h1>
        <p className="mt-1 text-ink-300">Describe what you want in your own words, or browse with filters.</p>
      </header>

      <DiscoveryForm
        initialValue={initialQuery}
        loading={state.status === 'loading'}
        deviceModel={deviceModel}
        onSubmit={(q, { forceCloud }) => {
          setParams({ q, ...(forceCloud ? { cloud: '1' } : {}) }, { replace: true })
          void run(q, { profile, forceCloud })
        }}
      />

      {state.status === 'error' && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.message}
          {state.raw && (
            <details className="mt-2 text-xs text-ink-300">
              <summary className="cursor-pointer">What the model returned</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{state.raw}</pre>
            </details>
          )}
        </div>
      )}

      {state.status === 'success' && <DiscoverySummary result={state.result} />}

      <div className="space-y-2">
        <FilterChips label="Genre" options={genreOptions} selected={genres} onToggle={toggle(setGenres)} />
        <FilterChips label="Mood" options={moodOptions} selected={moods} onToggle={toggle(setMoods)} />
      </div>

      <section aria-label="Results">
        {state.status === 'success' ? (
          <Results items={state.result.results.filter((r) => passes(r.title)).map((r) => ({ title: r.title, explanation: r.explanation, score: r.score }))} />
        ) : (
          <Results items={allTitles().filter(passes).map((title) => ({ title }))} />
        )}
      </section>
    </div>
  )
}

function Results({ items }: { items: { title: MediaTitle; explanation?: string; score?: number }[] }) {
  if (items.length === 0) return <p className="text-sm text-ink-500">Nothing in the catalogue matches. Try loosening a filter or rephrasing.</p>
  return (
    <MediaGrid>
      {items.map((i) => (
        <MediaCard key={i.title.id} title={i.title} explanation={i.explanation} score={i.score} />
      ))}
    </MediaGrid>
  )
}

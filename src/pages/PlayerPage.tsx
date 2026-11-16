import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { HeartPulse, MessageSquare } from 'lucide-react'
import { EventTimeline } from '../components/player/EventTimeline'
import { MetricTiles } from '../components/player/MetricTiles'
import { PlayerControls } from '../components/player/PlayerControls'
import { PlayerViewport } from '../components/player/PlayerViewport'
import { ServiceCheck } from '../components/player/ServiceCheck'
import { STATUS_LABEL } from '../components/player/labels'
import { usePlayer } from '../hooks/usePlayer'
import { formatDuration, getTitle } from '../services/catalogue/catalogue'
import { computeMetrics } from '../services/playback/metrics'

const DEFAULT_TITLE = 'interstellar'

export function PlayerPage() {
  const [params] = useSearchParams()
  const { state, store } = usePlayer()
  const requested = params.get('title')
  const titleId = requested && getTitle(requested) ? requested : (state.titleId ?? DEFAULT_TITLE)
  const title = getTitle(titleId)!

  useEffect(() => {
    store.load(titleId)
  }, [store, titleId])

  const metrics = state.session ? computeMetrics(state.session) : null
  const playing = state.status === 'playing' || state.status === 'buffering'

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">{title.title}</h1>
          <p className="text-sm text-ink-500">
            {title.year} · {formatDuration(title)} · 10-minute preview stand-in, no real video
          </p>
        </div>
        <span className="rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-300" aria-live="polite">
          {STATUS_LABEL[state.status]} · {state.throughputMbps} Mbps · {state.bufferSeconds.toFixed(1)} s buffered
        </span>
      </header>

      <PlayerViewport title={title} state={state} onToggle={() => (playing ? store.pause() : store.play())} />
      <PlayerControls state={state} store={store} />

      {metrics && <MetricTiles metrics={metrics} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-500">Playback events</h2>
          <EventTimeline events={state.session?.events ?? []} />
        </section>
        <div className="space-y-3">
          <Link to="/health" className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-5 hover:border-ink-700">
            <HeartPulse className="size-5 text-accent-400" aria-hidden />
            <span>
              <span className="block font-medium">Stream Health</span>
              <span className="text-sm text-ink-500">Charts and findings for this session</span>
            </span>
          </Link>
          <Link to="/assistant" className="flex items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-5 hover:border-ink-700">
            <MessageSquare className="size-5 text-accent-400" aria-hidden />
            <span>
              <span className="block font-medium">Ask why it's buffering</span>
              <span className="text-sm text-ink-500">The streaming assistant arrives in Phase 4</span>
            </span>
          </Link>
          <ServiceCheck />
          <p className="text-xs text-ink-500">
            Playback is modelled, not real video. In live mode the network data is real: download speed measured via Cloudflare and response time to the chosen
            service's website. The simulated scenarios are scripted. NYSUS has no access to any streaming service's own servers or accounts.
          </p>
        </div>
      </div>
    </div>
  )
}

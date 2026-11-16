import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { HeartPulse, MessageSquare } from 'lucide-react'
import { EventTimeline } from '../components/player/EventTimeline'
import { MetricTiles } from '../components/player/MetricTiles'
import { PlayerControls } from '../components/player/PlayerControls'
import { RetroTV } from '../components/player/RetroTV'
import { ServiceCheck } from '../components/player/ServiceCheck'
import { STATUS_LABEL } from '../components/player/labels'
import { usePlayer } from '../hooks/usePlayer'
import { getAppAssistantStore } from '../hooks/useAssistant'
import { formatDuration, getTitle } from '../services/catalogue/catalogue'
import { computeMetrics } from '../services/playback/metrics'

const DEFAULT_TITLE = 'interstellar'

export function PlayerPage() {
  const [params] = useSearchParams()
  const { state, store } = usePlayer()
  // Cosmetic: there is no audio, but the knob should still remember where it was turned to.
  const [volume, setVolume] = useState(80)
  const requested = params.get('title')
  const titleId = requested && getTitle(requested) ? requested : (state.titleId ?? DEFAULT_TITLE)
  const title = getTitle(titleId)!

  useEffect(() => {
    store.load(titleId)
  }, [store, titleId])

  const metrics = state.session ? computeMetrics(state.session) : null

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

      <RetroTV title={title} state={state} store={store} volume={volume} onVolume={setVolume} />
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
          <button
            type="button"
            onClick={() => getAppAssistantStore().ask('Why does my stream keep buffering?')}
            disabled={!state.session}
            className="flex w-full items-center gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-5 text-left hover:border-ink-700 disabled:opacity-50"
          >
            <MessageSquare className="size-5 text-accent-400" aria-hidden />
            <span>
              <span className="block font-medium">Ask why it's buffering</span>
              <span className="text-sm text-ink-500">{state.session ? 'The assistant investigates this session with its diagnostic tools' : 'Press play first, so there is telemetry to investigate'}</span>
            </span>
          </button>
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

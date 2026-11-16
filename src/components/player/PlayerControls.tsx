import { FastForward, Pause, Play, RotateCcw } from 'lucide-react'
import { LIVE_SCENARIO, QUALITY_LADDER, SCENARIOS, getScenario } from '../../data/demoScenarios'
import { STREAMING_SERVICES, getService } from '../../services/network/liveProbe'
import { CLIP_SECONDS, type QualityMode } from '../../services/playback/engine'
import type { PlayerSnapshot, PlayerStore } from '../../services/playback/playerStore'
import { formatClock } from '../../services/playback/metrics'
import type { ScenarioId } from '../../types/playback'

const select = 'rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm text-ink-100 focus:border-accent-400 focus:outline-none'

export function PlayerControls({ state, store }: { state: PlayerSnapshot; store: PlayerStore }) {
  const playing = state.status === 'playing' || state.status === 'buffering'
  const live = state.scenario === 'live'
  const waitingForFirstReading = live && state.live.latest === null && state.live.status !== 'budget_reached'
  const played = (state.positionSeconds / CLIP_SECONDS) * 100
  const buffered = (Math.min(CLIP_SECONDS, state.positionSeconds + state.bufferSeconds) / CLIP_SECONDS) * 100

  return (
    <div className="space-y-3">
      <div
        className="relative h-1.5 overflow-hidden rounded-full bg-ink-800"
        role="progressbar"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={CLIP_SECONDS}
        aria-valuenow={state.positionSeconds}
      >
        <div className="absolute inset-y-0 left-0 bg-ink-500" style={{ width: `${buffered}%` }} />
        <div className="absolute inset-y-0 left-0 bg-accent-500" style={{ width: `${played}%` }} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => (playing ? store.pause() : store.play())}
          disabled={state.status === 'ended' || (!playing && waitingForFirstReading)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-500 disabled:opacity-50"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? 'Pause' : waitingForFirstReading ? 'Measuring…' : 'Play'}
        </button>
        <span className="text-sm tabular-nums text-ink-300">
          {formatClock(state.positionSeconds * 1000)} / {formatClock(CLIP_SECONDS * 1000)}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!live && <button type="button" onClick={() => store.skip(30)} disabled={state.status === 'idle' || state.status === 'ended'} className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-ink-300 hover:text-ink-100 disabled:opacity-40">
            <FastForward className="size-3.5" aria-hidden /> Simulate 30 s
          </button>}
          <button type="button" onClick={() => store.restart()} className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-ink-300 hover:text-ink-100">
            <RotateCcw className="size-3.5" aria-hidden /> New session
          </button>
        </div>
      </div>

      {/* The same settings as the TV knobs, as plain dropdowns for anyone who prefers them. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-ink-500">
          Network
          <select className={select} value={state.scenario} onChange={(e) => store.setScenario(e.target.value as ScenarioId)}>
            <optgroup label="Live">
              <option value={LIVE_SCENARIO.id}>{LIVE_SCENARIO.label}</option>
            </optgroup>
            <optgroup label="Simulated">
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-500">
          Quality
          <select className={select} value={state.qualityMode} onChange={(e) => store.setQualityMode(e.target.value as QualityMode)}>
            <option value="auto">Auto ({state.quality})</option>
            {QUALITY_LADDER.map((q) => (
              <option key={q.id} value={q.id}>{q.id} · {q.bitrateKbps / 1000} Mbps</option>
            ))}
          </select>
        </label>
        {live ? (
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Streaming service
            <select className={select} value={state.live.serviceId} onChange={(e) => store.setService(e.target.value)}>
              {STREAMING_SERVICES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Simulation speed
            <select className={select} value={state.speed} onChange={(e) => store.setSpeed(Number(e.target.value))}>
              {[1, 2, 4, 10].map((s) => (
                <option key={s} value={s}>{s}×</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="text-xs text-ink-500">{getScenario(state.scenario).description}</p>
      {live && <LiveStatus state={state} />}
    </div>
  )
}

const LIVE_STATUS_TEXT = {
  idle: 'Paused: not measuring',
  measuring: 'Measuring',
  offline: 'No connection to the measurement server',
  budget_reached: 'Stopped after 150 MB to protect your data allowance. Start a new session to measure again.',
} as const

function LiveStatus({ state }: { state: PlayerSnapshot }) {
  const { live } = state
  const service = getService(live.serviceId).label
  return (
    <p className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-xs text-ink-300" aria-live="polite">
      <span className="font-medium text-ink-100">{LIVE_STATUS_TEXT[live.status]}</span>
      {live.latest && (
        <>
          {' · '}
          {live.latest.throughputMbps} Mbps download · {live.latest.latencyMs} ms to {service}
        </>
      )}
      {' · '}
      {(live.bytesUsed / 1_000_000).toFixed(1)} MB used
      {live.lastError && <span className="block text-ink-500">Last error: {live.lastError}</span>}
    </p>
  )
}

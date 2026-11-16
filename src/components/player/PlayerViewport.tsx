import type { CSSProperties } from 'react'
import { AlertTriangle, Clapperboard, Gauge, Loader2, Play, Wifi, WifiOff } from 'lucide-react'
import { MAX_BUFFER_SECONDS } from '../../services/playback/engine'
import { formatClock } from '../../services/playback/metrics'
import type { PlayerSnapshot } from '../../services/playback/playerStore'
import type { MediaTitle } from '../../types/media'
import type { QualityId } from '../../types/playback'
import { Artwork } from '../media/Artwork'
import { narrate, packetDuration, type Narration, type NarrationTone } from './narration'

/**
 * The player has no real video, so the screen shows what the simulation is doing instead:
 * picture sharpness follows the current quality, and the pipeline underneath animates the
 * download into the buffer and playback out of it, at rates taken from the player state.
 */

/** Lower rungs get a blockier, softer picture, so quality switches are visible. */
const PICTURE: Record<QualityId, { cell: number; blur: number }> = {
  '2160p': { cell: 0, blur: 0 },
  '1080p': { cell: 3, blur: 0 },
  '720p': { cell: 5, blur: 0.5 },
  '480p': { cell: 8, blur: 1.5 },
  '360p': { cell: 12, blur: 2.5 },
}

const TONE_DOT: Record<NarrationTone, string> = {
  idle: 'bg-ink-300',
  ok: 'bg-local',
  strained: 'bg-warn',
  stalled: 'bg-warn',
  error: 'bg-danger',
  done: 'bg-cream',
}

function Lane({ active, duration, tone, label }: { active: boolean; duration: number; tone: 'good' | 'short'; label: string }) {
  const dot = tone === 'good' ? 'bg-butter' : 'bg-accent-400'
  return (
    <div className="relative h-6 min-w-4 flex-1" aria-hidden title={label}>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-ink-700" />
      {active &&
        [0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute inset-0 animate-packet"
            style={{ '--packet-duration': `${duration}s`, animationDelay: `${(-duration * i) / 4}s` } as CSSProperties}
          >
            <span className={`absolute left-0 top-1/2 size-2 -translate-y-1/2 rounded-full ${dot}`} />
          </div>
        ))}
    </div>
  )
}

function Pipeline({ state, n }: { state: PlayerSnapshot; n: Narration }) {
  const have = state.throughputMbps
  const downloading = have > 0 && state.status !== 'idle' && state.status !== 'ended' && state.status !== 'error'
  const consuming = state.status === 'playing'
  const fill = Math.min(100, (state.bufferSeconds / MAX_BUFFER_SECONDS) * 100)
  const short = have < n.neededMbps
  // With a full buffer the player only fetches what it plays, so packets move at the video's rate.
  const downloadRate = n.trend === 'full' && consuming ? n.neededMbps : have

  return (
    <div className="flex items-center gap-2 sm:gap-3" role="group" aria-label="Simulated delivery pipeline">
      <div className="flex shrink-0 items-center gap-2">
        {state.status === 'error' ? <WifiOff className="hidden size-5 text-danger sm:block" aria-hidden /> : <Wifi className="hidden size-5 text-ink-300 sm:block" aria-hidden />}
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-wider text-ink-500">Network</div>
          <div className={`text-sm tabular-nums ${short && state.status !== 'idle' ? 'text-accent-300' : 'text-ink-100'}`}>{have.toFixed(1)} Mbps</div>
        </div>
      </div>

      <Lane active={downloading} duration={packetDuration(downloadRate)} tone={short ? 'short' : 'good'} label="Video downloading into the buffer" />

      <div className="w-20 shrink-0 sm:w-32">
        <div className="flex items-baseline justify-between text-[10px] uppercase tracking-wider text-ink-500">
          <span>Buffer</span>
          <span className="tabular-nums normal-case tracking-normal text-ink-300">{state.bufferSeconds.toFixed(1)} s</span>
        </div>
        <div
          className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-800"
          role="meter"
          aria-label="Buffered video"
          aria-valuemin={0}
          aria-valuemax={MAX_BUFFER_SECONDS}
          aria-valuenow={state.bufferSeconds}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${n.trend === 'draining' || state.status === 'buffering' ? 'bg-accent-500' : 'popcorn-stripes [--stripe:6px]'}`}
            style={{ width: `${fill}%` }}
          />
        </div>
        <div className="mt-0.5 text-[10px] text-ink-500">{n.trend}</div>
      </div>

      <Lane active={consuming} duration={packetDuration(n.neededMbps)} tone="good" label="Buffered video being played" />

      <div className="flex shrink-0 items-center gap-2">
        <Gauge className="hidden size-5 text-ink-300 sm:block" aria-hidden />
        <div className="leading-tight">
          <div className="text-[10px] uppercase tracking-wider text-ink-500">{state.quality} needs</div>
          <div className="text-sm tabular-nums text-ink-100">{n.neededMbps} Mbps</div>
        </div>
      </div>
    </div>
  )
}

export function PlayerViewport({ title, state, onToggle }: { title: MediaTitle; state: PlayerSnapshot; onToggle: () => void }) {
  const playing = state.status === 'playing' || state.status === 'buffering'
  const n = narrate(state)
  const pic = PICTURE[state.quality]
  const dim = state.status !== 'playing'

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900">
      <div aria-hidden className="popcorn-stripes h-1" />
      <div className="relative aspect-video overflow-hidden bg-black">
        {/* The "picture": generated artwork, softened and pixelated to match the current quality. */}
        <div className="absolute inset-0 transition-[filter] duration-700" style={{ filter: `blur(${pic.blur}px) brightness(${dim ? 0.55 : 0.9})` }}>
          <Artwork title={title} className="size-full" showLabels={false} />
        </div>
        {pic.cell > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40 transition-[background-size] duration-700"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgb(0 0 0 / 0.55) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / 0.55) 1px, transparent 1px)',
              backgroundSize: `${pic.cell}px ${pic.cell}px`,
            }}
          />
        )}
        {/* Projector beam: a slow scan line while frames are being shown. */}
        {state.status === 'playing' && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="h-full w-full animate-scan bg-gradient-to-b from-transparent via-cream/10 to-transparent" />
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.65))]" />

        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cream/85">
          <Clapperboard className="size-3" aria-hidden /> Simulated playback
        </span>
        <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs tabular-nums text-cream/85" aria-label="Current quality">
          {state.quality}
          {state.qualityMode === 'auto' ? ' · auto' : ''}
        </span>

        {n.recent && (
          <span
            key={n.recent}
            className="absolute left-1/2 top-12 max-w-[85%] -translate-x-1/2 truncate rounded-full border border-cream/20 bg-ink-950/80 px-3 py-1 text-xs text-cream backdrop-blur-sm"
          >
            {n.recent}
          </span>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
          disabled={state.status === 'ended'}
          className="absolute inset-0 flex items-center justify-center focus-visible:outline-none"
        >
          <span className="flex flex-col items-center gap-4 px-6 text-center">
            <span className="line-clamp-2 text-2xl font-semibold tracking-tight text-cream/90 drop-shadow-[0_2px_12px_rgb(0_0_0/0.8)] md:text-4xl">{title.title}</span>
            {state.status === 'buffering' ? (
              <span role="status" className="flex flex-col items-center gap-2 text-cream">
                <Loader2 className="size-12 animate-spin" aria-hidden />
                <span className="text-sm">Buffering…</span>
              </span>
            ) : state.status === 'error' ? (
              <span role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-black/70 px-6 py-4 text-cream">
                <AlertTriangle className="size-8 text-danger" aria-hidden />
                <span className="text-sm">Playback error: waiting for the connection</span>
              </span>
            ) : !playing ? (
              <span className="flex size-16 items-center justify-center rounded-full bg-accent-500/85 shadow-lg shadow-black/40 ring-4 ring-cream/20 transition-transform hover:scale-105">
                {state.status === 'ended' ? <span className="text-xs text-cream">Ended</span> : <Play className="ml-1 size-7 fill-cream text-cream" aria-hidden />}
              </span>
            ) : (
              <span className="font-mono text-xs tabular-nums tracking-widest text-cream/60">SIMULATED FRAME {formatClock(state.positionSeconds * 1000)}</span>
            )}
          </span>
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-3 pt-10">
          <p className="flex items-center gap-2 text-sm font-medium text-cream md:text-base">
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${TONE_DOT[n.tone]} ${n.tone === 'stalled' || n.tone === 'strained' ? 'animate-shimmer' : ''}`} />
            {n.headline}
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-ink-800 px-4 py-4">
        <Pipeline state={state} n={n} />
        <div className="space-y-1">
          <p className="text-sm text-ink-100">{n.detail}</p>
          <p className="text-xs text-ink-500">{n.source}</p>
        </div>
      </div>
    </div>
  )
}

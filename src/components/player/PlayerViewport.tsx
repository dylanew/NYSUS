import { AlertTriangle, Loader2, Pause, Play } from 'lucide-react'
import type { MediaTitle } from '../../types/media'
import type { PlayerSnapshot } from '../../services/playback/playerStore'
import { Artwork } from '../media/Artwork'
import { STATUS_LABEL } from './labels'

export function PlayerViewport({ title, state, onToggle }: { title: MediaTitle; state: PlayerSnapshot; onToggle: () => void }) {
  const playing = state.status === 'playing' || state.status === 'buffering'
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-800 bg-black">
      <Artwork title={title} className={`aspect-video transition-[filter] duration-500 ${state.status === 'playing' ? '' : 'brightness-75'}`} />
      <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/80">
        Simulated playback
      </span>
      <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs tabular-nums text-white/80" aria-label="Current quality">
        {state.quality}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? 'Pause' : 'Play'}
        disabled={state.status === 'ended'}
        className="absolute inset-0 flex items-center justify-center focus-visible:outline-none"
      >
        {state.status === 'buffering' ? (
          <span role="status" className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="size-12 animate-spin" aria-hidden />
            <span className="text-sm">Buffering…</span>
          </span>
        ) : state.status === 'error' ? (
          <span role="alert" className="flex flex-col items-center gap-2 rounded-xl bg-black/70 px-6 py-4 text-white">
            <AlertTriangle className="size-8 text-danger" aria-hidden />
            <span className="text-sm">Playback error: waiting for the connection</span>
          </span>
        ) : !playing ? (
          <span className="flex size-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm transition-colors hover:bg-white/25">
            {state.status === 'ended' ? <span className="text-xs text-white">{STATUS_LABEL.ended}</span> : <Play className="size-7 fill-white text-white" aria-hidden />}
          </span>
        ) : (
          <span className="sr-only">
            <Pause aria-hidden />
          </span>
        )}
      </button>
    </div>
  )
}

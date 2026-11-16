import { useState } from 'react'
import { LIVE_SCENARIO, QUALITY_LADDER, SCENARIOS } from '../../data/demoScenarios'
import type { QualityMode } from '../../services/playback/engine'
import type { PlayerSnapshot, PlayerStore } from '../../services/playback/playerStore'
import type { MediaTitle } from '../../types/media'
import { Knob } from './Knob'
import { PlayerReadout, PlayerScreen } from './PlayerScreen'

/**
 * The Player as an old wooden console TV: a curved picture tube in a bezel, three rotary
 * knobs on the side (channel = network scenario, picture = quality, volume), a speaker
 * grille and a brass badge. Built entirely from CSS and SVG. The knobs are sliders, and the
 * same settings stay available as ordinary dropdowns under the set.
 */

const CHANNELS = [LIVE_SCENARIO, ...SCENARIOS]
const PICTURES: QualityMode[] = ['auto', ...QUALITY_LADDER.map((q) => q.id)]
const SHORT_CHANNEL: Record<string, string> = { live: 'Live', stable: 'Stable', unstable: 'Unstable', poor: 'Poor', interruption: 'Drop-out' }

type Osd = { id: number; text: string; volume?: number }

export function RetroTV({
  title,
  state,
  store,
  volume,
  onVolume,
}: {
  title: MediaTitle
  state: PlayerSnapshot
  store: PlayerStore
  volume: number
  onVolume: (v: number) => void
}) {
  const playing = state.status === 'playing' || state.status === 'buffering'
  const channel = Math.max(0, CHANNELS.findIndex((c) => c.id === state.scenario))
  const ch = CHANNELS[channel]!
  const picture = Math.max(0, PICTURES.indexOf(state.qualityMode))
  const pictureText = state.qualityMode === 'auto' ? `Auto (${state.quality})` : state.qualityMode

  // On-screen display, the green text an old set flashes when you turn a knob. Derived from
  // changes to the settings (so the dropdowns trigger it too), not from mount.
  const [seen, setSeen] = useState({ scenario: state.scenario, qualityMode: state.qualityMode, volume })
  const [osd, setOsd] = useState<Osd | null>(null)
  if (seen.scenario !== state.scenario || seen.qualityMode !== state.qualityMode || seen.volume !== volume) {
    const id = (osd?.id ?? 0) + 1
    if (seen.scenario !== state.scenario) setOsd({ id, text: `CH ${channel + 1}  ${ch.label.toUpperCase()}` })
    else if (seen.qualityMode !== state.qualityMode) setOsd({ id, text: `PICTURE  ${pictureText.toUpperCase()}` })
    else setOsd({ id, text: volume === 0 ? 'MUTE' : 'VOLUME', volume })
    setSeen({ scenario: state.scenario, qualityMode: state.qualityMode, volume })
  }

  return (
    <section aria-label="Player" className="mx-auto w-full max-w-5xl">
      <div className="tv-cabinet wood-grain rounded-[1.75rem] p-3 sm:rounded-[2.25rem] sm:p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-5">
          {/* Bezel around the tube. */}
          <div className="tv-bezel min-w-0 flex-1 rounded-[1.4rem] p-2.5 sm:rounded-[1.9rem] sm:p-4">
            <PlayerScreen title={title} state={state} onToggle={() => (playing ? store.pause() : store.play())}>
              {/* Channel-change static. Keyed on the channel so it replays on every change. */}
              <div key={state.scenario} aria-hidden className="tv-static pointer-events-none absolute animate-static" />
              {osd && (
                <div
                  key={osd.id}
                  aria-hidden
                  className="pointer-events-none absolute bottom-14 right-4 animate-osd font-mono text-sm font-bold tracking-widest text-[#6dff8f] [text-shadow:0_0_6px_rgb(60_255_110/0.8),2px_2px_0_rgb(0_0_0/0.8)] md:text-base"
                >
                  <div className="text-right">{osd.text}</div>
                  {osd.volume !== undefined && osd.volume > 0 && (
                    <div className="mt-1 flex justify-end gap-0.5">
                      {Array.from({ length: 20 }, (_, i) => (
                        <span key={i} className={`h-3 w-1.5 ${i < Math.round(osd.volume! / 5) ? 'bg-[#6dff8f]' : 'bg-[#6dff8f]/20'}`} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </PlayerScreen>
          </div>

          {/* Control column: knobs, speaker grille, badge. Becomes a row on phones. */}
          <div className="flex shrink-0 flex-row items-center justify-around gap-2 sm:w-28 sm:flex-col sm:justify-start sm:gap-4 sm:py-2">
            <Knob
              label="Channel dial"
              caption="Channel"
              count={CHANNELS.length}
              index={channel}
              onChange={(i) => store.setScenario(CHANNELS[i]!.id)}
              valueText={`Channel ${channel + 1}: ${ch.label}`}
              plate={`${channel + 1} · ${SHORT_CHANNEL[ch.id] ?? ch.label}`}
            />
            <Knob
              label="Picture dial"
              caption="Picture"
              count={PICTURES.length}
              index={picture}
              onChange={(i) => store.setQualityMode(PICTURES[i]!)}
              valueText={pictureText}
              plate={state.qualityMode === 'auto' ? `Auto ${state.quality}` : state.qualityMode}
            />
            <Knob
              label="Volume"
              caption="Volume"
              count={101}
              index={volume}
              onChange={onVolume}
              valueText={volume === 0 ? 'Muted' : `${volume}%`}
              plate={volume === 0 ? 'Mute' : String(volume)}
              stepped={false}
              pageStep={10}
            />
            <div aria-hidden className="tv-grille hidden w-full flex-1 rounded-lg sm:block sm:min-h-16" />
            <div aria-hidden className="hidden items-center gap-1.5 sm:flex">
              <span className={`size-2 rounded-full ${playing ? 'bg-accent-400 shadow-[0_0_8px_var(--color-accent-400)]' : 'bg-ink-700'}`} />
              <span className="tv-badge rounded px-2 py-0.5 text-[10px] font-bold tracking-[0.3em] text-ink-950">NYSUS</span>
            </div>
          </div>
        </div>

        {/* The explanatory readout sits on a dark faceplate under the tube. */}
        <div className="mt-4 rounded-2xl bg-ink-950/85 px-4 py-4 shadow-[inset_0_2px_6px_rgb(0_0_0/0.7),0_1px_0_rgb(255_220_180/0.12)] sm:mt-5">
          <PlayerReadout state={state} />
        </div>
      </div>
      {/* Feet. */}
      <div aria-hidden className="flex justify-between px-[12%]">
        <span className="tv-foot h-3 w-14 rounded-b-md sm:h-4 sm:w-20" />
        <span className="tv-foot h-3 w-14 rounded-b-md sm:h-4 sm:w-20" />
      </div>
    </section>
  )
}

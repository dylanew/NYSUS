import { bitrateOf, getScenario } from '../../data/demoScenarios'
import { getService } from '../../services/network/liveProbe'
import { MAX_BUFFER_SECONDS, RESUME_BUFFER_SECONDS } from '../../services/playback/engine'
import { formatClock } from '../../services/playback/metrics'
import type { PlayerSnapshot } from '../../services/playback/playerStore'
import type { PlaybackEvent } from '../../types/playback'
import { describeEvent } from './labels'

export type NarrationTone = 'idle' | 'ok' | 'strained' | 'stalled' | 'error' | 'done'
export type BufferTrend = 'filling' | 'draining' | 'full' | 'steady'

export interface Narration {
  /** One short line: what the player is doing right now. */
  headline: string
  /** Why, in terms of the numbers the simulation is using. */
  detail: string
  /** Where the network numbers come from (scripted scenario or live measurement). */
  source: string
  tone: NarrationTone
  trend: BufferTrend
  /** Download rate the current quality needs, in Mbps. */
  neededMbps: number
  /** A notable event from the last few simulated seconds, for a brief callout. */
  recent: string | null
}

const RECENT_WINDOW_MS = 6000
const mbps = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)} Mbps`

/** Whether the download keeps up with playback: throughput vs the bitrate of the current quality. */
export function bufferTrend(state: Pick<PlayerSnapshot, 'throughputMbps' | 'bufferSeconds' | 'quality' | 'status'>): BufferTrend {
  if (state.bufferSeconds >= MAX_BUFFER_SECONDS - 0.5) return 'full'
  const needed = bitrateOf(state.quality) / 1000
  // While paused or stalled nothing is consumed, so any download fills the buffer.
  const consuming = state.status === 'playing'
  if (!consuming) return state.throughputMbps > 0 ? 'filling' : 'steady'
  return state.throughputMbps >= needed ? 'filling' : 'draining'
}

export function recentEvent(state: Pick<PlayerSnapshot, 'session'>): PlaybackEvent | null {
  const s = state.session
  if (!s) return null
  for (let i = s.events.length - 1; i >= 0; i--) {
    const e = s.events[i]!
    if (s.elapsedMs - e.timestamp > RECENT_WINDOW_MS) return null
    if (e.type === 'quality_change' || e.type === 'buffer_start' || e.type === 'buffer_end' || e.type === 'network_change' || e.type === 'playback_error')
      return e
  }
  return null
}

function sourceLine(state: PlayerSnapshot): string {
  const scenario = getScenario(state.scenario)
  if (state.scenario !== 'live') return `Scripted scenario · ${scenario.label}: ${scenario.description}`
  const service = getService(state.live.serviceId).label
  if (state.live.status === 'budget_reached') return `Live mode · measurement budget used up, holding the last reading`
  if (state.live.status === 'offline') return `Live mode · your browser reports no connection`
  if (!state.live.latest) return `Live mode · taking the first measurement of your connection…`
  return `Live mode · real download speed from your connection, response time measured to ${service}`
}

/** Plain-language account of what the simulated player is doing, derived only from its state. */
export function narrate(state: PlayerSnapshot): Narration {
  const neededMbps = bitrateOf(state.quality) / 1000
  const have = state.throughputMbps
  const buffer = state.bufferSeconds.toFixed(1)
  const trend = bufferTrend(state)
  const recentE = recentEvent(state)
  const base = { source: sourceLine(state), trend, neededMbps, recent: recentE ? describeEvent(recentE) : null }
  const auto = state.qualityMode === 'auto'

  switch (state.status) {
    case 'idle': {
      const waiting = state.scenario === 'live' && !state.live.latest && state.live.status !== 'budget_reached'
      return {
        ...base,
        tone: 'idle',
        headline: waiting ? 'Measuring your connection' : `Ready to simulate ${state.quality} playback`,
        detail: waiting
          ? 'A short download test runs first so the player has a real speed to work with.'
          : `Press play. No real video is streamed: NYSUS models how a player downloads video into a ${MAX_BUFFER_SECONDS} s buffer and plays it out, second by second.`,
      }
    }
    case 'playing': {
      const keepingUp = have >= neededMbps
      return {
        ...base,
        tone: keepingUp ? 'ok' : 'strained',
        headline: keepingUp ? `Playing at ${state.quality}` : `Playing at ${state.quality}, buffer draining`,
        detail: keepingUp
          ? `Downloading at ${mbps(have)}; ${state.quality} needs ${mbps(neededMbps)}, so the buffer stays ${trend === 'full' ? 'full' : 'topped up'} (${buffer} s ahead).`
          : `Only ${mbps(have)} is arriving but ${state.quality} needs ${mbps(neededMbps)}. ${buffer} s of video left before a stall${auto ? ', unless auto quality steps down first' : ''}.`,
      }
    }
    case 'buffering':
      return {
        ...base,
        tone: 'stalled',
        headline: 'Buffering: playback stalled',
        detail:
          have > 0
            ? `The buffer ran dry. At ${mbps(have)} against ${mbps(neededMbps)} for ${state.quality}, it needs ${RESUME_BUFFER_SECONDS} s of video before resuming (${buffer} s so far).`
            : `No data is arriving. The player waits for ${RESUME_BUFFER_SECONDS} s of video and reports an error if the connection stays down.`,
      }
    case 'paused':
      return {
        ...base,
        tone: 'idle',
        headline: `Paused at ${formatClock(state.positionSeconds * 1000)}`,
        detail: `Nothing is being played, but the player keeps downloading into the buffer (${buffer} of ${MAX_BUFFER_SECONDS} s).`,
      }
    case 'error':
      return {
        ...base,
        tone: 'error',
        headline: 'Connection lost',
        detail: 'No data has arrived for several seconds, so playback stopped with an error. It recovers on its own when the network returns.',
      }
    case 'ended':
      return {
        ...base,
        tone: 'done',
        headline: 'Preview finished',
        detail: 'The 10-minute simulated preview played to the end. Open Stream Health for the full session, or start a new one.',
      }
  }
}

/** Faster connection, faster packets: seconds for one animated packet to cross its lane. */
export function packetDuration(mbps: number): number {
  return Math.min(4, Math.max(0.6, 8 / (mbps + 0.5)))
}

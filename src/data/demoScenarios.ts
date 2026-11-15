import type { NetworkSample, QualityId, ScenarioId } from '../types/playback'

/**
 * Deterministic network scenarios. "Noise" comes from a hash of (scenario, second), so the
 * same second of the same scenario always produces the same sample: reproducible for tests
 * and for the demo, while still looking organic.
 */
export function noise(seed: string, t: number): number {
  let h = 2166136261
  const s = `${seed}:${t}`
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

const round = (x: number, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp
const jitter = (seed: string, t: number, spread: number) => (noise(seed, t) - 0.5) * 2 * spread

export interface NetworkScenario {
  id: ScenarioId
  label: string
  description: string
  /** Network conditions `t` seconds after the scenario was selected. */
  at(t: number): NetworkSample
}

export const SCENARIOS: NetworkScenario[] = [
  {
    id: 'stable',
    label: 'Stable connection',
    description: 'High throughput, low latency, no interruptions.',
    at: (t) => ({ throughputMbps: round(25 + jitter('stable', t, 1.2)), latencyMs: Math.round(18 + jitter('stable-l', t, 4)) }),
  },
  {
    id: 'unstable',
    label: 'Unstable connection',
    description: 'Throughput swings up and down, with a long dip every 45 seconds.',
    at: (t) => {
      const cycle = t % 45
      const dip = cycle >= 20 && cycle < 38
      const base = dip ? 0.5 : 8 + 4 * Math.sin((2 * Math.PI * t) / 45)
      return {
        throughputMbps: round(Math.max(0.2, base + jitter('unstable', t, dip ? 0.2 : 1.5))),
        latencyMs: Math.round((dip ? 220 : 70) + jitter('unstable-l', t, 30)),
      }
    },
  },
  {
    id: 'poor',
    label: 'Poor connection',
    description: 'Starts fine, then throughput collapses below what even the lowest quality needs.',
    at: (t) => {
      const mbps = t < 15 ? 6 + jitter('poor', t, 0.5) : 0.45 + jitter('poor', t, 0.3)
      return { throughputMbps: round(Math.max(0.2, mbps)), latencyMs: Math.round((t < 15 ? 40 : 180) + jitter('poor-l', t, 40)) }
    },
  },
  {
    id: 'interruption',
    label: 'Connection interruption',
    description: 'Healthy, then the connection drops completely for 20 seconds and comes back.',
    at: (t) => {
      const offline = t >= 25 && t < 45
      return offline
        ? { throughputMbps: 0, latencyMs: 0 }
        : { throughputMbps: round(15 + jitter('interruption', t, 1)), latencyMs: Math.round(30 + jitter('interruption-l', t, 6)) }
    },
  },
]

export function getScenario(id: ScenarioId): NetworkScenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!
}

/** Bitrate ladder, highest first. */
export const QUALITY_LADDER: { id: QualityId; bitrateKbps: number }[] = [
  { id: '2160p', bitrateKbps: 16000 },
  { id: '1080p', bitrateKbps: 5000 },
  { id: '720p', bitrateKbps: 2500 },
  { id: '480p', bitrateKbps: 1000 },
  { id: '360p', bitrateKbps: 600 },
]

export function bitrateOf(q: QualityId): number {
  return QUALITY_LADDER.find((l) => l.id === q)!.bitrateKbps
}

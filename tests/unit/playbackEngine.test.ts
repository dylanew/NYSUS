import { describe, expect, it } from 'vitest'
import { SCENARIOS, getScenario, noise } from '../../src/data/demoScenarios'
import { CLIP_SECONDS, PlaybackEngine } from '../../src/services/playback/engine'
import { computeMetrics } from '../../src/services/playback/metrics'
import type { ScenarioId } from '../../src/types/playback'

const run = (scenario: ScenarioId, seconds: number, setup?: (e: PlaybackEngine) => void) => {
  const e = new PlaybackEngine({ titleId: 'dune', scenario })
  setup?.(e)
  e.play()
  e.advance(seconds)
  return e
}
const types = (e: PlaybackEngine, t: string) => e.snapshot().session!.events.filter((x) => x.type === t)

describe('network scenarios', () => {
  it('are deterministic per second', () => {
    for (const s of SCENARIOS) expect(s.at(17)).toEqual(s.at(17))
    expect(noise('a', 1)).toBe(noise('a', 1))
    expect(noise('a', 1)).not.toBe(noise('a', 2))
  })
  it('model the four described conditions', () => {
    const range = (id: ScenarioId, from: number, to: number) => Array.from({ length: to - from }, (_, i) => getScenario(id).at(from + i).throughputMbps)
    expect(Math.min(...range('stable', 0, 300))).toBeGreaterThan(20)
    expect(Math.max(...range('unstable', 20, 38))).toBeLessThan(1)
    expect(Math.max(...range('poor', 20, 200))).toBeLessThan(0.8)
    expect(range('interruption', 25, 45).every((x) => x === 0)).toBe(true)
    expect(range('interruption', 45, 60).every((x) => x > 10)).toBe(true)
  })
})

describe('PlaybackEngine', () => {
  it('produces identical telemetry for identical actions', () => {
    expect(run('unstable', 120).snapshot().session).toEqual(run('unstable', 120).snapshot().session)
  })

  it('stable: no buffering, quality climbs', () => {
    const e = run('stable', 120)
    expect(types(e, 'buffer_start')).toHaveLength(0)
    expect(e.snapshot().quality).toBe('1080p')
    expect(e.snapshot().positionSeconds).toBe(120)
  })

  it('unstable: occasional buffering during throughput dips, with quality changes', () => {
    const e = run('unstable', 120)
    expect(types(e, 'buffer_start')).toHaveLength(2)
    expect(types(e, 'buffer_start').every((x) => (x.throughputMbps ?? 99) < 1)).toBe(true)
    expect(types(e, 'quality_change').length).toBeGreaterThan(4)
  })

  it('poor: frequent buffering and the lowest quality', () => {
    const e = run('poor', 120)
    expect(types(e, 'buffer_start').length).toBeGreaterThanOrEqual(5)
    expect(e.snapshot().quality).toBe('360p')
  })

  it('interruption: stall, then a playback error, then recovery', () => {
    const e = run('interruption', 60)
    const err = types(e, 'playback_error')
    expect(err).toHaveLength(1)
    expect(err[0]!.timestamp).toBe(44_000)
    expect(types(e, 'play').at(-1)!.details).toBe('Recovered after playback error')
    expect(e.snapshot().status).toBe('playing')
  })

  it('a fixed high quality on an unstable network buffers more than auto', () => {
    const fixed = computeMetrics(run('unstable', 120, (e) => e.setQualityMode('1080p')).snapshot().session!)
    const auto = computeMetrics(run('unstable', 120).snapshot().session!)
    expect(fixed.bufferingRatioPct).toBeGreaterThan(auto.bufferingRatioPct * 2)
    expect(fixed.qualityChanges).toHaveLength(0)
  })

  it('pausing stops the position but the session clock keeps running', () => {
    const e = run('stable', 10)
    e.pause()
    e.advance(5)
    expect(e.snapshot().positionSeconds).toBe(10)
    expect(e.snapshot().session!.elapsedMs).toBe(15_000)
  })

  it('records network changes with ids and ends at the end of the clip', () => {
    const e = run('stable', 5)
    e.setScenario('poor')
    expect(types(e, 'network_change').at(-1)).toMatchObject({ id: expect.stringMatching(/^s1-e\d+$/), scenario: 'poor', timestamp: 5000 })
    const done = run('stable', CLIP_SECONDS + 5)
    expect(done.snapshot().status).toBe('ended')
    expect(types(done, 'ended')).toHaveLength(1)
  })
})

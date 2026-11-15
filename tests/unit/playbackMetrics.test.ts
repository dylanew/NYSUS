import { describe, expect, it } from 'vitest'
import { computeMetrics, stateDurations } from '../../src/services/playback/metrics'
import { analyseBuffering } from '../../src/services/diagnostics/buffering'
import { healthFindings } from '../../src/services/diagnostics/findings'
import { PlaybackEngine } from '../../src/services/playback/engine'
import type { PlaybackEvent, PlaybackSession } from '../../src/types/playback'

let n = 0
const ev = (timestamp: number, type: PlaybackEvent['type'], extra: Partial<PlaybackEvent> = {}): PlaybackEvent => ({ id: `t-e${++n}`, sessionId: 't', timestamp, type, ...extra })
const session = (events: PlaybackEvent[], elapsedMs: number): PlaybackSession => ({ id: 't', titleId: 'dune', startedAt: 0, elapsedMs, status: 'playing', events })

describe('playback metrics (hand-built timeline)', () => {
  // 0–10 s playing, 10–13 s buffering, 13–20 s playing, 20–30 s paused, 30–40 s playing.
  const s = session(
    [
      ev(0, 'play'),
      ev(2000, 'telemetry_sample', { throughputMbps: 10, bitrateKbps: 5000, latencyMs: 20 }),
      ev(4000, 'telemetry_sample', { throughputMbps: 2, bitrateKbps: 2500, latencyMs: 100 }),
      ev(9000, 'quality_change', { fromQuality: '1080p', quality: '720p' }),
      ev(10000, 'buffer_start', { throughputMbps: 0.5, bitrateKbps: 2500, latencyMs: 200, quality: '720p' }),
      ev(13000, 'buffer_end', { durationMs: 3000 }),
      ev(20000, 'pause'),
      ev(30000, 'play'),
    ],
    40_000,
  )

  it('splits time by state, excluding paused time from observed time', () => {
    expect(stateDurations(s.events, 40_000)).toEqual({ playing: 27_000, buffering: 3_000, paused: 10_000, error: 0 })
  })

  it('calculates ratio, averages, frequency and quality changes', () => {
    const m = computeMetrics(s)
    expect(m.observedMs).toBe(30_000)
    expect(m.bufferingRatioPct).toBe(10)
    expect(m.bufferingEvents).toBe(1)
    expect(m.bufferingPerMinute).toBe(2)
    expect(m.averageThroughputMbps).toBe(6)
    expect(m.averageBitrateKbps).toBe(3750)
    expect(m.averageLatencyMs).toBe(60)
    expect(m.qualityChanges).toEqual([{ eventId: expect.any(String), timestamp: 9000, from: '1080p', to: '720p' }])
  })

  it('supports a time window', () => {
    const m = computeMetrics(s, { from: 5000, to: 15000 })
    expect(m.bufferingMs).toBe(3000)
    expect(m.playingMs).toBe(7000)
    expect(m.bufferingEvents).toBe(1)
  })

  it('returns zeros, not NaN, for an empty session', () => {
    const m = computeMetrics(session([], 0))
    expect(m.bufferingRatioPct).toBe(0)
    expect(m.averageThroughputMbps).toBeNull()
  })
})

describe('buffering analysis and findings', () => {
  it('pairs stalls with the conditions around them, citing event ids', () => {
    const e = new PlaybackEngine({ titleId: 'dune', scenario: 'unstable' })
    e.play()
    e.advance(60)
    const incidents = analyseBuffering(e.snapshot().session!)
    expect(incidents).toHaveLength(1)
    expect(incidents[0]).toMatchObject({ startEventId: expect.stringMatching(/^s1-e/), durationMs: 3000 })
    expect(incidents[0]!.contributingFactors.join(' ')).toMatch(/below the video bitrate/)
  })

  it('reports a healthy stable session', () => {
    const e = new PlaybackEngine({ titleId: 'dune', scenario: 'stable' })
    e.play()
    e.advance(60)
    const { findings } = healthFindings(e.snapshot().session!)
    expect(findings).toEqual([expect.objectContaining({ severity: 'good', title: 'No buffering' })])
  })

  it('flags an interruption as critical with the error event as evidence', () => {
    const e = new PlaybackEngine({ titleId: 'dune', scenario: 'interruption' })
    e.play()
    e.advance(60)
    const { findings } = healthFindings(e.snapshot().session!)
    const critical = findings.filter((f) => f.severity === 'critical')
    expect(critical[0]!.title).toBe('Playback error at 0:44')
    expect(critical[0]!.evidenceEventIds).toHaveLength(1)
  })

  it('waits for enough playback before judging', () => {
    const e = new PlaybackEngine({ titleId: 'dune' })
    e.play()
    e.advance(3)
    expect(healthFindings(e.snapshot().session!).findings[0]!.title).toBe('Not enough playback yet')
  })
})

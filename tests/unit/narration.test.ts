import { describe, expect, it } from 'vitest'
import { bufferTrend, narrate, packetDuration, recentEvent } from '../../src/components/player/narration'
import { PlaybackEngine } from '../../src/services/playback/engine'
import type { PlayerSnapshot } from '../../src/services/playback/playerStore'
import type { ScenarioId } from '../../src/types/playback'

const LIVE_IDLE = { status: 'idle', serviceId: 'netflix', latest: null, samples: 0, bytesUsed: 0, lastError: null } as const

function snap(engine: PlaybackEngine, live: PlayerSnapshot['live'] = { ...LIVE_IDLE }): PlayerSnapshot {
  return { ...engine.snapshot(), titleId: 'dune', speed: 1, live }
}

function engineFor(scenario: ScenarioId) {
  return new PlaybackEngine({ titleId: 'dune', scenario })
}

describe('player narration', () => {
  it('explains the idle player and the scripted scenario', () => {
    const n = narrate(snap(engineFor('unstable')))
    expect(n.tone).toBe('idle')
    expect(n.headline).toBe('Ready to simulate 720p playback')
    expect(n.detail).toMatch(/No real video is streamed/)
    expect(n.source).toMatch(/Scripted scenario · Unstable connection/)
  })

  it('reports healthy playback with the numbers behind it', () => {
    const e = engineFor('stable')
    e.play()
    e.advance(20)
    const n = narrate(snap(e))
    expect(n.tone).toBe('ok')
    expect(n.headline).toMatch(/^Playing at /)
    expect(n.detail).toMatch(/Downloading at \d+ Mbps; \S+ needs [\d.]+ Mbps/)
  })

  it('explains a stall in terms of throughput vs bitrate', () => {
    const e = engineFor('poor')
    e.setQualityMode('1080p')
    e.play()
    let guard = 0
    while (e.snapshot().status !== 'buffering' && guard++ < 120) e.tick()
    const n = narrate(snap(e))
    expect(n.tone).toBe('stalled')
    expect(n.headline).toBe('Buffering: playback stalled')
    expect(n.detail).toMatch(/needs 3 s of video before resuming/)
    expect(n.recent).toMatch(/Buffering started/)
  })

  it('reports a lost connection', () => {
    const e = engineFor('interruption')
    e.play()
    let guard = 0
    while (e.snapshot().status !== 'error' && guard++ < 200) e.tick()
    expect(narrate(snap(e))).toMatchObject({ tone: 'error', headline: 'Connection lost' })
  })

  it('describes live mode before and after the first measurement', () => {
    const e = engineFor('live')
    expect(narrate(snap(e)).headline).toBe('Measuring your connection')
    const measured = narrate(snap(e, { ...LIVE_IDLE, status: 'measuring', latest: { throughputMbps: 40, latencyMs: 20 }, samples: 1 }))
    expect(measured.headline).toBe('Ready to simulate 720p playback')
    expect(measured.source).toMatch(/response time measured to Netflix/)
  })

  it('works out whether the buffer is filling or draining', () => {
    expect(bufferTrend({ status: 'playing', quality: '1080p', throughputMbps: 2, bufferSeconds: 5 })).toBe('draining')
    expect(bufferTrend({ status: 'playing', quality: '1080p', throughputMbps: 8, bufferSeconds: 5 })).toBe('filling')
    expect(bufferTrend({ status: 'paused', quality: '1080p', throughputMbps: 1, bufferSeconds: 5 })).toBe('filling')
    expect(bufferTrend({ status: 'playing', quality: '1080p', throughputMbps: 1, bufferSeconds: 12 })).toBe('full')
  })

  it('only calls out events from the last few seconds', () => {
    const e = engineFor('stable')
    e.play()
    e.setQualityMode('480p')
    expect(recentEvent(snap(e))?.type).toBe('quality_change')
    e.advance(10)
    expect(recentEvent(snap(e))).toBeNull()
  })

  it('animates packets faster on faster connections, within bounds', () => {
    expect(packetDuration(100)).toBe(0.6)
    expect(packetDuration(0)).toBe(4)
    expect(packetDuration(5)).toBeLessThan(packetDuration(1))
  })
})

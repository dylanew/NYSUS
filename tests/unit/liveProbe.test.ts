import { describe, expect, it } from 'vitest'
import {
  DATA_BUDGET_BYTES,
  MONITOR_INTERVAL_MS,
  SPEED_ENDPOINT,
  STREAMING_SERVICES,
  checkServices,
  createLiveMonitor,
  measureThroughput,
  pingService,
  type MonitorTimers,
  type ProbeDeps,
} from '../../src/services/network/liveProbe'
import { PlaybackEngine } from '../../src/services/playback/engine'

/** A fake network: each request advances a fake clock by a fixed latency plus transfer time. */
function fakeNet(opts: { mbps: number; rttMs: number; fail?: (url: string) => boolean }) {
  let clock = 0
  const calls: { url: string; init?: RequestInit }[] = []
  const deps: ProbeDeps = {
    now: () => clock,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init })
      clock += opts.rttMs
      if (opts.fail?.(url)) throw new TypeError('Failed to fetch')
      const bytes = url.startsWith(SPEED_ENDPOINT) ? Number(new URL(url).searchParams.get('bytes')) : 0
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => {
          clock += (bytes * 8) / (opts.mbps * 1000)
          return new ArrayBuffer(bytes)
        },
      } as Response
    }) as typeof fetch,
  }
  return { deps, calls }
}

function fakeTimers() {
  const queue: (() => void)[] = []
  const t: MonitorTimers & { flush: () => Promise<void>; pending: () => number } = {
    setTimeout: (fn) => (queue.push(fn), queue.length),
    clearTimeout: () => void queue.splice(0),
    pending: () => queue.length,
    async flush() {
      const fn = queue.shift()
      fn?.()
      await new Promise((r) => setTimeout(r, 0))
    },
  }
  return t
}
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('live probe', () => {
  it('measures throughput from transfer time, excluding the round trip', async () => {
    const { deps, calls } = fakeNet({ mbps: 40, rttMs: 30 })
    const r = await measureThroughput(2_000_000, deps)
    expect(r.mbps).toBeCloseTo(40, 5)
    expect(r.ttfbMs).toBe(30)
    expect(calls[0]!.url).toMatch(/^https:\/\/speed\.cloudflare\.com\/__down\?bytes=2000000&r=/)
    expect(calls[0]!.init).toMatchObject({ cache: 'no-store', credentials: 'omit' })
  })

  it('pings a service website in no-cors mode with a cache buster', async () => {
    const { deps, calls } = fakeNet({ mbps: 10, rttMs: 42 })
    expect(await pingService(STREAMING_SERVICES[0]!, deps)).toBe(42)
    expect(calls[0]!.url).toMatch(/^https:\/\/www\.netflix\.com\/favicon\.ico\?nysus=/)
    expect(calls[0]!.init).toMatchObject({ mode: 'no-cors', cache: 'no-store' })
  })

  it('checks every service and marks failures as unreachable', async () => {
    const { deps } = fakeNet({ mbps: 10, rttMs: 25, fail: (u) => u.includes('disneyplus') })
    const results = await checkServices(deps)
    expect(results).toHaveLength(STREAMING_SERVICES.length)
    expect(results.find((r) => r.serviceId === 'disney')).toMatchObject({ reachable: false, responseMs: null })
    expect(results.find((r) => r.serviceId === 'netflix')).toMatchObject({ reachable: true, firstContactMs: 25, responseMs: 25 })
  })
})

describe('live monitor', () => {
  it('takes a reading, then repeats on an interval and adapts the download size', async () => {
    const { deps, calls } = fakeNet({ mbps: 80, rttMs: 20 })
    const timers = fakeTimers()
    const m = createLiveMonitor(deps, timers)
    m.setService('prime')
    m.start()
    await settle()
    // The first 250 kB download is too short to time on its own, so it includes the round
    // trip and reads low; the next download is resized to about 400 ms and reads true.
    expect(m.getSnapshot()).toMatchObject({ status: 'measuring', samples: 1, latest: { throughputMbps: 44.44, latencyMs: 20 } })
    expect(calls[1]!.url).toContain('primevideo.com')
    await timers.flush()
    expect(m.getSnapshot()).toMatchObject({ samples: 2, latest: { throughputMbps: 80 } })
    await timers.flush()
    // 80 Mbps for 400 ms ≈ 4 MB, capped at 3 MB.
    expect(calls[4]!.url).toContain('bytes=3000000')
    expect(MONITOR_INTERVAL_MS).toBe(2000)
    m.stop()
    expect(m.getSnapshot().status).toBe('idle')
    expect(timers.pending()).toBe(0)
  })

  it('reports zero throughput when the measurement server is unreachable', async () => {
    const { deps } = fakeNet({ mbps: 10, rttMs: 20, fail: () => true })
    const m = createLiveMonitor(deps, fakeTimers())
    m.start()
    await settle()
    expect(m.getSnapshot()).toMatchObject({ status: 'offline', latest: { throughputMbps: 0, latencyMs: 0 }, lastError: 'Failed to fetch' })
  })

  it('stops once the data budget is used', async () => {
    const { deps } = fakeNet({ mbps: 1000, rttMs: 1 })
    const timers = fakeTimers()
    const m = createLiveMonitor(deps, timers)
    m.start()
    for (let i = 0; i < 80 && m.getSnapshot().status !== 'budget_reached'; i++) await (i === 0 ? settle() : timers.flush())
    expect(m.getSnapshot().status).toBe('budget_reached')
    expect(m.getSnapshot().bytesUsed).toBeGreaterThanOrEqual(DATA_BUDGET_BYTES)
    expect(m.running).toBe(false)
  })
})

describe('engine in live mode', () => {
  it('plays from real samples and stalls when they drop to zero', () => {
    const e = new PlaybackEngine({ titleId: 'dune', scenario: 'live' })
    e.setLiveSample({ throughputMbps: 30, latencyMs: 15 })
    e.play()
    e.advance(10)
    expect(e.snapshot()).toMatchObject({ status: 'playing', throughputMbps: 30, latencyMs: 15 })
    e.setLiveSample({ throughputMbps: 0, latencyMs: 0 })
    e.advance(20)
    const types = e.snapshot().session!.events.map((ev) => ev.type)
    expect(types).toContain('buffer_start')
    expect(types).toContain('playback_error')
  })
})

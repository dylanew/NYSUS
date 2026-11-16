import type { NetworkSample } from '../../types/playback'

/**
 * Live network measurement from the viewer's own browser.
 *
 * What this measures, honestly:
 * - Throughput: a timed download from Cloudflare's public speed-test endpoint (the same one
 *   speed.cloudflare.com uses). Streaming services also deliver video from CDNs, so it is a
 *   fair stand-in for "how much video can this connection pull right now".
 * - Service response: a timed request to each streaming service's public website. This is
 *   round-trip time to their web front door from where you are. It does NOT see their video
 *   servers, and no streaming service publishes real-time server performance.
 *
 * Everything is injected (fetch, clock, timers) so it is fully testable.
 */
export const SPEED_ENDPOINT = 'https://speed.cloudflare.com/__down'

export interface StreamingService {
  id: string
  label: string
  /** A small public resource on the service's website, fetched in no-cors mode for timing. */
  probeUrl: string
}

export const STREAMING_SERVICES: StreamingService[] = [
  { id: 'netflix', label: 'Netflix', probeUrl: 'https://www.netflix.com/favicon.ico' },
  { id: 'prime', label: 'Prime Video', probeUrl: 'https://www.primevideo.com/favicon.ico' },
  { id: 'disney', label: 'Disney+', probeUrl: 'https://www.disneyplus.com/favicon.ico' },
  { id: 'youtube', label: 'YouTube', probeUrl: 'https://www.youtube.com/favicon.ico' },
  { id: 'appletv', label: 'Apple TV+', probeUrl: 'https://tv.apple.com/favicon.ico' },
  { id: 'iplayer', label: 'BBC iPlayer', probeUrl: 'https://www.bbc.co.uk/favicon.ico' },
]

export function getService(id: string): StreamingService {
  return STREAMING_SERVICES.find((s) => s.id === id) ?? STREAMING_SERVICES[0]!
}

export interface ProbeDeps {
  fetch: typeof globalThis.fetch
  now: () => number
}

const browserDeps = (): ProbeDeps => ({ fetch: (...a) => globalThis.fetch(...a), now: () => performance.now() })

let bust = 0
const cacheBuster = () => `${Date.now().toString(36)}${(++bust).toString(36)}`

export interface ThroughputResult {
  mbps: number
  bytes: number
  totalMs: number
  /** Time to first byte, a rough round-trip measure to the CDN edge. */
  ttfbMs: number
}

export async function measureThroughput(bytes: number, deps: ProbeDeps = browserDeps()): Promise<ThroughputResult> {
  const t0 = deps.now()
  const res = await deps.fetch(`${SPEED_ENDPOINT}?bytes=${Math.round(bytes)}&r=${cacheBuster()}`, { cache: 'no-store', credentials: 'omit' })
  if (!res.ok) throw new Error(`Speed endpoint answered ${res.status}`)
  const t1 = deps.now()
  const body = await res.arrayBuffer()
  const t2 = deps.now()
  // Transfer time excludes the request round trip when the payload is big enough to time.
  const transferMs = t2 - t1 >= 50 ? t2 - t1 : Math.max(1, t2 - t0)
  return { mbps: (body.byteLength * 8) / transferMs / 1000, bytes: body.byteLength, totalMs: t2 - t0, ttfbMs: t1 - t0 }
}

/** Round-trip to a service's website. Opaque (no-cors) responses still time correctly. */
export async function pingService(service: StreamingService, deps: ProbeDeps = browserDeps()): Promise<number> {
  const t0 = deps.now()
  await deps.fetch(`${service.probeUrl}?nysus=${cacheBuster()}`, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' })
  return deps.now() - t0
}

export interface ServiceCheck {
  serviceId: string
  label: string
  reachable: boolean
  /** First request: includes DNS lookup and connection setup. */
  firstContactMs: number | null
  /** Median of the follow-up requests over the warm connection. */
  responseMs: number | null
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : null
}

/** Checks every service once: one cold request, then `warm` follow-ups. */
export async function checkServices(deps: ProbeDeps = browserDeps(), warm = 3): Promise<ServiceCheck[]> {
  const out: ServiceCheck[] = []
  for (const service of STREAMING_SERVICES) {
    try {
      const first = await pingService(service, deps)
      const rest: number[] = []
      for (let i = 0; i < warm; i++) rest.push(await pingService(service, deps))
      out.push({ serviceId: service.id, label: service.label, reachable: true, firstContactMs: Math.round(first), responseMs: Math.round(median(rest)!) })
    } catch {
      out.push({ serviceId: service.id, label: service.label, reachable: false, firstContactMs: null, responseMs: null })
    }
  }
  return out
}

// ── Continuous monitor used by the live player ────────────────────────────

export const MONITOR_INTERVAL_MS = 2000
/** Aim for downloads of about this long: long enough to time, short enough to stay light. */
const TARGET_TRANSFER_MS = 400
const MIN_BYTES = 100_000
const MAX_BYTES = 3_000_000
/** Stop measuring after this much data in one run, so a forgotten tab can't eat a data plan. */
export const DATA_BUDGET_BYTES = 150_000_000

export type MonitorStatus = 'idle' | 'measuring' | 'offline' | 'budget_reached'

export interface MonitorSnapshot {
  status: MonitorStatus
  serviceId: string
  /** Most recent measurement fed to the player, or null before the first one completes. */
  latest: NetworkSample | null
  samples: number
  bytesUsed: number
  lastError: string | null
}

export interface MonitorTimers {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

const browserTimers: MonitorTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as number),
}

export function createLiveMonitor(deps: ProbeDeps = browserDeps(), timers: MonitorTimers = browserTimers) {
  let snap: MonitorSnapshot = { status: 'idle', serviceId: STREAMING_SERVICES[0]!.id, latest: null, samples: 0, bytesUsed: 0, lastError: null }
  let running = false
  let handle: unknown = null
  let nextBytes = 250_000
  let generation = 0
  const listeners = new Set<() => void>()

  const set = (patch: Partial<MonitorSnapshot>) => {
    snap = { ...snap, ...patch }
    listeners.forEach((l) => l())
  }

  async function step(gen: number) {
    if (!running || gen !== generation) return
    if (snap.bytesUsed >= DATA_BUDGET_BYTES) {
      running = false
      set({ status: 'budget_reached' })
      return
    }
    try {
      const t = await measureThroughput(nextBytes, deps)
      let latencyMs = t.ttfbMs
      try {
        latencyMs = await pingService(getService(snap.serviceId), deps)
      } catch {
        // Service website unreachable: keep the CDN round trip as the latency figure.
      }
      if (gen !== generation) return
      nextBytes = Math.min(MAX_BYTES, Math.max(MIN_BYTES, (t.mbps * 1000 * TARGET_TRANSFER_MS) / 8))
      set({
        status: 'measuring',
        latest: { throughputMbps: Math.round(t.mbps * 100) / 100, latencyMs: Math.round(latencyMs) },
        samples: snap.samples + 1,
        bytesUsed: snap.bytesUsed + t.bytes,
        lastError: null,
      })
    } catch (e) {
      if (gen !== generation) return
      // A failed download is what an outage looks like to a player: zero throughput.
      set({ status: 'offline', latest: { throughputMbps: 0, latencyMs: 0 }, samples: snap.samples + 1, lastError: e instanceof Error ? e.message : String(e) })
    }
    if (running && gen === generation) handle = timers.setTimeout(() => void step(gen), MONITOR_INTERVAL_MS)
  }

  return {
    getSnapshot: () => snap,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    get running() {
      return running
    },
    start() {
      if (running) return
      running = true
      if (snap.status === 'budget_reached') set({ bytesUsed: 0 })
      set({ status: 'measuring' })
      void step(++generation)
    },
    stop() {
      if (!running) return
      running = false
      generation++
      if (handle !== null) timers.clearTimeout(handle)
      handle = null
      if (snap.status !== 'budget_reached') set({ status: 'idle' })
    },
    setService(id: string) {
      set({ serviceId: getService(id).id })
    },
    /** Forget measurements, e.g. for a new session. */
    reset() {
      set({ latest: null, samples: 0, bytesUsed: 0, lastError: null, status: running ? snap.status : 'idle' })
    },
  }
}

export type LiveMonitor = ReturnType<typeof createLiveMonitor>

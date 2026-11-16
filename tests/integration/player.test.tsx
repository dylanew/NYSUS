import { describe, expect, it } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '../helpers/renderRoute'
import { createPlayerStore, playerStore, type Scheduler } from '../../src/services/playback/playerStore'

function fakeScheduler() {
  const timers = new Map<number, { fn: () => void; ms: number }>()
  let id = 0
  const s: Scheduler & { tick: () => void; active: () => number[] } = {
    setInterval: (fn, ms) => (timers.set(++id, { fn, ms }), id),
    clearInterval: (h) => void timers.delete(h as number),
    tick: () => [...timers.values()].forEach((t) => t.fn()),
    active: () => [...timers.values()].map((t) => t.ms),
  }
  return s
}

describe('player store', () => {
  it('runs a timer only while playing, at the chosen speed', () => {
    const sched = fakeScheduler()
    const store = createPlayerStore(sched, () => 0)
    store.load('dune')
    expect(sched.active()).toEqual([])
    store.play()
    expect(sched.active()).toEqual([1000])
    store.setSpeed(4)
    expect(sched.active()).toEqual([250])
    sched.tick()
    sched.tick()
    expect(store.getSnapshot().positionSeconds).toBe(2)
    store.pause()
    expect(store.getSnapshot().status).toBe('paused')
  })

  it('keeps network and quality settings across a new session', () => {
    const store = createPlayerStore(fakeScheduler(), () => 0)
    store.load('dune')
    store.setScenario('poor')
    store.setQualityMode('480p')
    store.play()
    store.restart()
    const s = store.getSnapshot()
    expect(s).toMatchObject({ scenario: 'poor', qualityMode: '480p', status: 'idle', session: null })
  })
})

describe('Player → Stream Health journey', () => {
  it('plays an interruption scenario and shows the error on both pages', async () => {
    await renderRoute('/player?title=arrival')
    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Network'), 'interruption')
    await userEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]!)
    act(() => playerStore.skip(44))

    expect(screen.getByRole('alert')).toHaveTextContent(/waiting for the connection|Playback error/)
    // Shown in the event timeline and as the viewport's recent-event callout.
    expect(screen.getAllByText(/Error: Network unreachable/).length).toBeGreaterThan(0)
    expect(screen.getByText('Connection lost')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Buffered video' })).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('link', { name: /Stream Health/ })[0]!)
    expect(await screen.findByText(/Playback error at 0:44/)).toBeInTheDocument()
    expect(screen.getAllByText('Critical').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Throughput and bitrate over time')).toBeInTheDocument()
    act(() => playerStore.pause())
  })
})

describe('player store in live mode', () => {
  it('measures before play, runs at real time, and feeds readings to the engine', async () => {
    const { createLiveMonitor } = await import('../../src/services/network/liveProbe')
    let clock = 0
    const fetch = (async (input: RequestInfo | URL) => {
      clock += 10
      const bytes = Number(new URL(String(input)).searchParams.get('bytes') ?? 0)
      return { ok: true, status: 200, arrayBuffer: async () => ((clock += (bytes * 8) / 20_000), new ArrayBuffer(bytes)) } as Response
    }) as typeof globalThis.fetch
    const pending: (() => void)[] = []
    const monitor = createLiveMonitor({ fetch, now: () => clock }, { setTimeout: (fn) => pending.push(fn), clearTimeout: () => void pending.splice(0) })
    const sched = fakeScheduler()
    const store = createPlayerStore(sched, () => 0, monitor)
    store.load('dune')
    store.setSpeed(10)
    store.setScenario('live')
    expect(monitor.running).toBe(true)
    await new Promise((r) => setTimeout(r, 0))
    expect(store.getSnapshot().live.latest).toMatchObject({ throughputMbps: 20 })
    expect(monitor.running).toBe(false) // first reading taken; idle until play

    store.play()
    expect(monitor.running).toBe(true)
    expect(sched.active()).toEqual([1000]) // live ignores the 10× setting
    expect(store.getSnapshot().speed).toBe(1)
    sched.tick()
    expect(store.getSnapshot().throughputMbps).toBe(20)
    store.skip(30)
    expect(store.getSnapshot().positionSeconds).toBe(1) // no fast-forwarding reality

    store.setService('iplayer')
    expect(store.getSnapshot().session!.events.at(-1)!.details).toBe('Live latency now measured to BBC iPlayer')
    store.pause()
    expect(monitor.running).toBe(false)
  })
})

describe('retro TV knobs', () => {
  it('are keyboard sliders that drive the same settings as the dropdowns', async () => {
    await renderRoute('/player?title=arrival')
    act(() => playerStore.setScenario('stable'))
    act(() => playerStore.setQualityMode('auto'))

    const channel = screen.getByRole('slider', { name: 'Channel dial' })
    expect(channel).toHaveAttribute('aria-valuetext', 'Channel 2: Stable connection')
    channel.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(playerStore.getSnapshot().scenario).toBe('poor')
    expect(screen.getByLabelText('Network')).toHaveValue('poor')

    const picture = screen.getByRole('slider', { name: 'Picture dial' })
    picture.focus()
    await userEvent.keyboard('{End}')
    expect(playerStore.getSnapshot().qualityMode).toBe('360p')

    const volume = screen.getByRole('slider', { name: 'Volume' })
    volume.focus()
    await userEvent.keyboard('{Home}')
    expect(volume).toHaveAttribute('aria-valuetext', 'Muted')
  })
})

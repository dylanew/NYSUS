import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../../src/app/routes'
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
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/player?title=arrival'] })} />)
    expect(screen.getByRole('heading', { name: 'Arrival' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Network'), 'interruption')
    await userEvent.click(screen.getAllByRole('button', { name: 'Play' })[0]!)
    act(() => playerStore.skip(44))

    expect(screen.getByRole('alert')).toHaveTextContent(/waiting for the connection|Playback error/)
    expect(screen.getByText(/Error: Network unreachable/)).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('link', { name: /Stream Health/ })[0]!)
    expect(await screen.findByText(/Playback error at 0:44/)).toBeInTheDocument()
    expect(screen.getAllByText('Critical').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Throughput and bitrate over time')).toBeInTheDocument()
    act(() => playerStore.pause())
  })
})

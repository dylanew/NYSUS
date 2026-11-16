import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoute } from '../helpers/renderRoute'
import { fakeModel } from './fakeModel'

const output = JSON.stringify({
  genres: ['science fiction'], moods: ['dark', 'suspenseful'], preferredThemes: ['space exploration'], excludeGenres: [],
  contentType: 'any', length: 'any', confidence: 0.7,
})

vi.mock('../../src/hooks/useAiDeps', () => ({
  useAiDeps: () => ({ deps: { hybrid: fakeModel(output, 'on_device'), cloudOnly: fakeModel(output, 'in_cloud'), probe: async () => 'available' }, deviceModel: null }),
}))
vi.mock('../../src/services/ai/onDeviceAvailability', async (orig) => ({
  ...(await orig<typeof import('../../src/services/ai/onDeviceAvailability')>()),
  probeOnDeviceAvailability: async () => 'available',
}))

beforeEach(() => localStorage.clear())

const renderAt = (path: string) => renderRoute(path)

describe('Discover → watchlist journey', () => {
  it('shows the inference source, explained results, and saves to the watchlist', async () => {
    await renderAt('/discover')
    await userEvent.type(screen.getByLabelText(/what would you like to watch/i), 'Something like Interstellar, but darker')
    await userEvent.click(screen.getByRole('button', { name: /find something/i }))

    expect(await screen.findByText('Processed on your device')).toBeInTheDocument()
    expect(screen.getByText(/as a reference/)).toHaveTextContent('Interstellar')

    const results = screen.getByRole('region', { name: 'Results' })
    const cards = within(results).getAllByRole('article')
    expect(cards.length).toBeGreaterThan(2)
    expect(within(cards[0]!).getByText(/^Recommended because/)).toBeInTheDocument()

    const firstTitle = within(cards[0]!).getAllByRole('link')[1]!.textContent!
    await userEvent.click(within(cards[0]!).getByRole('button', { name: /add to watchlist/i }))
    expect(within(cards[0]!).getByRole('button', { name: /in watchlist/i })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getAllByRole('link', { name: 'Watchlist' })[0]!)
    await screen.findByRole('heading', { name: 'Watchlist', level: 1 })
    expect(screen.getByRole('link', { name: firstTitle })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /mark watched/i }))
    expect(screen.getByText(/Watched \(1\)/)).toBeInTheDocument()
  })

  it('filters the catalogue by genre without a query', async () => {
    await renderAt('/discover')
    await userEvent.click(screen.getByRole('button', { name: 'animation' }))
    const cards = within(screen.getByRole('region', { name: 'Results' })).getAllByRole('article')
    expect(cards.map((c) => within(c).getAllByRole('link')[1]!.textContent)).toEqual(['Spirited Away', 'Arcane'])
  })
})

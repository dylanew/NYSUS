import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscoveryPrompt } from '../../src/components/ai/DiscoveryPrompt'
import { fakeModel, VALID_JSON } from './fakeModel'

describe('DiscoveryPrompt', () => {
  it('shows extracted preferences and the real inference source', async () => {
    const deps = { hybrid: fakeModel(VALID_JSON, 'on_device'), cloudOnly: fakeModel(VALID_JSON), probe: async () => 'available' as const }
    render(<DiscoveryPrompt deps={deps} deviceModel={null} probe={async () => 'available'} />)
    await userEvent.type(screen.getByLabelText(/what would you like to watch/i), 'dark sci-fi')
    await userEvent.click(screen.getByRole('button', { name: /understand my request/i }))
    const badge = await screen.findByRole('status')
    expect(badge).toHaveTextContent('Processed on your device')
    expect(badge).toHaveAttribute('data-inference-source', 'on_device')
    expect(screen.getByText('science fiction')).toBeInTheDocument()
  })

  it('labels cloud fallback honestly', async () => {
    const deps = { hybrid: fakeModel(VALID_JSON, 'in_cloud'), cloudOnly: fakeModel(VALID_JSON), probe: async () => 'unsupported' as const }
    render(<DiscoveryPrompt deps={deps} deviceModel={null} probe={async () => 'unsupported'} />)
    await userEvent.type(screen.getByLabelText(/what would you like to watch/i), 'comedy')
    await userEvent.click(screen.getByRole('button', { name: /understand my request/i }))
    expect(await screen.findByRole('status')).toHaveTextContent('Local model unavailable — using cloud fallback')
  })

  it('explains when Firebase is not configured', async () => {
    render(<DiscoveryPrompt deps={null} deviceModel={null} probe={async () => 'unsupported'} />)
    await userEvent.type(screen.getByLabelText(/what would you like to watch/i), 'anything')
    await userEvent.click(screen.getByRole('button', { name: /understand my request/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not configured/)
  })
})

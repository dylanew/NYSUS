import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { AssistantChat } from '../../src/components/assistant/AssistantChat'
import { createAssistantStore } from '../../src/services/assistant/assistantStore'
import { contextFor, scriptedChat, sessionFor, type Step } from '../helpers/assistantFixtures'

// The app-wide store, with Gemini replaced by a scripted chat. Tools and data are real.
const app = vi.hoisted(() => ({ steps: [] as unknown[] }))
vi.mock('../../src/hooks/useAssistant', async (orig) => {
  const real = await orig<typeof import('../../src/hooks/useAssistant')>()
  const { createAssistantStore: create } = await import('../../src/services/assistant/assistantStore')
  const { scriptedChat: chat } = await import('../helpers/assistantFixtures')
  const store = create({ factory: chat(app.steps as Step[]).factory, modelName: 'gemini-test' })
  return { ...real, getAppAssistantStore: () => store, useAssistant: (s = store) => real.useAssistant(s) }
})

afterEach(() => localStorage.clear())

const DIAGNOSE: Step[] = [
  { calls: [{ name: 'get_playback_metrics', args: {} }, { name: 'analyse_buffering', args: {} }] },
  { calls: [{ name: 'generate_diagnostic_report', args: {} }] },
]

function renderChat(steps: Step[], session = sessionFor([['poor', 60]])) {
  const { factory } = scriptedChat(steps)
  const store = createAssistantStore({ factory, modelName: 'gemini-test', ctx: contextFor(session.session, { engine: session.engine }) })
  render(
    <MemoryRouter>
      <AssistantChat store={store} />
    </MemoryRouter>,
  )
  return { store, session: session.session }
}

describe('AssistantChat', () => {
  it('shows each real tool call, the grounded answer, the report card and checked citations', async () => {
    const s = sessionFor([['poor', 60]])
    const stall = s.session.events.find((e) => e.type === 'buffer_start')!
    renderChat([...DIAGNOSE, { text: `**Observed** A stall began at ${stall.id}.\n\n- Try lowering quality` }], s)

    await userEvent.click(screen.getByRole('button', { name: 'Why does my stream keep buffering?' }))

    const tools = await screen.findByRole('list', { name: 'Tool activity' })
    expect(within(tools).getAllByRole('listitem').map((li) => li.dataset.tool)).toEqual(['get_playback_metrics', 'analyse_buffering', 'generate_diagnostic_report'])
    expect(within(tools).getByText(/Investigating buffering events/)).toBeInTheDocument()

    const report = screen.getByRole('region', { name: 'Diagnostic report' })
    expect(within(report).getByText(/stayed there/)).toBeInTheDocument()
    expect(within(report).getByText(/high confidence/)).toBeInTheDocument()

    expect(screen.getAllByText(stall.id)[0]!.dataset.eventId).toBe(stall.id)
    expect(screen.getByText(/1 cited event checked against the telemetry/)).toBeInTheDocument()
    expect(screen.getByText('Cloud AI')).toBeInTheDocument()
  })

  it('shows catalogue results from search_catalogue as cards', async () => {
    renderChat([{ calls: [{ name: 'search_catalogue', args: { query: 'like Interstellar but darker', maxResults: 3 } }] }, { text: 'Try Gravity.' }])
    await userEvent.type(screen.getByLabelText(/message the streaming assistant/i), 'Something like Interstellar but darker{Enter}')
    const recs = await screen.findByRole('region', { name: 'Recommended titles' })
    expect(within(recs).getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('flags an id the model invented', async () => {
    renderChat([{ text: 'The stall at s1-e999 was caused by the network.' }])
    await userEvent.type(screen.getByLabelText(/message the streaming assistant/i), 'why?{Enter}')
    expect(await screen.findByText(/Not found in any tool result: s1-e999/)).toBeInTheDocument()
    expect(screen.getByText(/No tools used for this reply/)).toBeInTheDocument()
  })

  it('without Firebase, offers the rules-based diagnosis and labels it as no AI', async () => {
    const s = sessionFor([['interruption', 70]])
    const store = createAssistantStore({ factory: null, ctx: contextFor(s.session, { engine: s.engine }) })
    render(
      <MemoryRouter>
        <AssistantChat store={store} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/isn't configured here/)).toBeInTheDocument()
    expect(screen.getByLabelText(/message the streaming assistant/i)).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /run diagnosis without ai/i }))
    expect(screen.getByText(/Rules-based diagnosis, no AI/)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Diagnostic report' })).getByText(/stopped with 1 error/)).toBeInTheDocument()
  })
})

describe('assistant across the app', () => {
  it('Stream Health → "Ask the assistant" opens the drawer and investigates the live player session', async () => {
    app.steps.push(...DIAGNOSE, { text: 'Throughput fell below the bitrate.' })
    const { playerStore } = await import('../../src/services/playback/playerStore')
    playerStore.load('interstellar')
    playerStore.setScenario('poor')
    playerStore.play()
    playerStore.skip(40)
    playerStore.pause()

    render(<RouterProvider router={createMemoryRouter((await import('../../src/app/routes')).routes, { initialEntries: ['/health'] })} />)
    await userEvent.click(screen.getByRole('button', { name: /ask the assistant to investigate/i }))
    const drawer = await screen.findByRole('dialog', { name: 'Streaming assistant' })
    expect(await within(drawer).findByText('Throughput fell below the bitrate.')).toBeInTheDocument()
    expect(within(drawer).getByRole('region', { name: 'Diagnostic report' })).toBeInTheDocument()
  })
})

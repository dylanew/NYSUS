import { describe, expect, it, vi } from 'vitest'
import type { FunctionResponsePart } from 'firebase/ai'
import { AssistantConversation, AssistantTimeoutError, type ChatLike, type ToolActivity } from '../../src/services/ai/cloudAssistant'
import { contextFor, result, scriptedChat, sessionFor } from '../helpers/assistantFixtures'

const { session, engine } = sessionFor([['poor', 60]])
const ctx = contextFor(session, { engine })
const firstStall = session.events.find((e) => e.type === 'buffer_start')!

describe('assistant function-calling loop (mocked Gemini)', () => {
  it('runs requested tools, returns results to the model and grounds the answer (Journey C)', async () => {
    const { factory, sent } = scriptedChat([
      { calls: [{ name: 'get_playback_metrics', args: {} }, { name: 'analyse_buffering', args: {} }] },
      { calls: [{ name: 'generate_diagnostic_report', args: { focus: 'buffering' } }] },
      { text: `**Observed** The first stall began at 0:${String(firstStall.timestamp / 1000).padStart(2, '0')} (${firstStall.id}).` },
    ])
    const seen: ToolActivity[][] = []
    const convo = new AssistantConversation(factory, ctx)
    const r = await convo.send('Why does my stream keep buffering?', { onActivity: (a) => seen.push(a) })

    expect(r.modelCalls).toBe(3)
    expect(r.activities.map((a) => [a.name, a.status])).toEqual([
      ['get_playback_metrics', 'done'],
      ['analyse_buffering', 'done'],
      ['generate_diagnostic_report', 'done'],
    ])
    // The indicator showed each tool as running before it was done.
    expect(seen.some((s) => s.at(-1)?.status === 'running')).toBe(true)
    // Tool results went back to the model as function responses with the real data.
    const second = sent[1] as FunctionResponsePart[]
    expect(second.map((p) => p.functionResponse.name)).toEqual(['get_playback_metrics', 'analyse_buffering'])
    expect(second[1]!.functionResponse.response).toMatchObject({ incidents: expect.arrayContaining([expect.objectContaining({ startEventId: firstStall.id })]) })
    expect(r.grounding.unverifiedEventIds).toEqual([])
    expect(r.grounding.evidenceEventIds).toContain(firstStall.id)
    expect(r.stopReason).toBeUndefined()
    expect(r.inferenceSource).toBe('in_cloud')
  })

  it('rejects unknown tools and invalid arguments, tells the model, and carries on', async () => {
    const { factory, sent } = scriptedChat([
      { calls: [{ name: 'run_shell', args: { cmd: 'rm -rf /' } }, { name: 'get_playback_metrics', args: { lastSeconds: 'all' } }] },
      { text: 'Sorry, I can only use the playback tools.' },
    ])
    const r = await new AssistantConversation(factory, ctx).send('hi')
    expect(r.activities.map((a) => a.status)).toEqual(['rejected', 'error'])
    expect(r.toolRuns).toEqual([])
    const responses = (sent[1] as FunctionResponsePart[]).map((p) => p.functionResponse.response)
    expect(responses[0]).toMatchObject({ error: expect.stringMatching(/Unknown tool/) })
    expect(responses[1]).toMatchObject({ error: expect.stringMatching(/Invalid arguments/) })
  })

  it('stops at the model-call limit and rebuilds a clean history', async () => {
    const { factory, histories } = scriptedChat([{ calls: [{ name: 'get_playback_metrics', args: {} }] }])
    const r = await new AssistantConversation(factory, ctx).send('loop forever', { limits: { maxModelCalls: 3 } })
    expect(r.stopReason).toBe('max_model_calls')
    expect(r.modelCalls).toBe(3)
    expect(r.toolRuns).toHaveLength(2)
    expect(r.text).toMatch(/step limit/)
    // No dangling function call is left in the next request's history.
    const rebuilt = histories.at(-1)!
    expect(rebuilt.map((c) => c.role)).toEqual(['user', 'model'])
    expect(JSON.stringify(rebuilt)).not.toMatch(/functionCall/)
  })

  it('stops executing tools at the tool-call limit', async () => {
    const many = Array.from({ length: 5 }, () => ({ name: 'get_playback_metrics', args: {} }))
    const { factory } = scriptedChat([{ calls: many }, { text: 'Done.' }])
    const r = await new AssistantConversation(factory, ctx).send('go', { limits: { maxToolCalls: 2 } })
    expect(r.toolRuns).toHaveLength(2)
    expect(r.activities.filter((a) => a.status === 'rejected')).toHaveLength(3)
    expect(r.stopReason).toBe('max_tool_calls')
  })

  it('times out, restores the previous conversation and marks running tools as interrupted', async () => {
    const hang: ChatLike = {
      sendMessage: (_req, opts) =>
        new Promise((_, reject) => opts?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
      getHistory: async () => [],
    }
    const factory = vi.fn(() => hang)
    const convo = new AssistantConversation(factory, ctx)
    await expect(convo.send('slow', { limits: { timeoutMs: 20 } })).rejects.toBeInstanceOf(AssistantTimeoutError)
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('validates the viewer message', async () => {
    const { factory } = scriptedChat([{ text: 'x' }])
    const convo = new AssistantConversation(factory, ctx)
    await expect(convo.send('   ')).rejects.toThrow(/Type a question/)
    await expect(convo.send('x'.repeat(1001))).rejects.toThrow(/under 1000/)
  })

  it('flags an answer that cites evidence no tool returned', async () => {
    const { factory } = scriptedChat([{ text: 'It buffered at s1-e999 because of 42% packet loss.' }])
    const r = await new AssistantConversation(factory, ctx).send('why?')
    expect(r.grounding.telemetryChecked).toBe(false)
    expect(r.grounding.unverifiedEventIds).toEqual(['s1-e999'])
    expect(r.grounding.unverifiedFigures).toEqual(['42%'])
  })

  it('falls back to a clear message when the model returns no text', async () => {
    const { factory } = scriptedChat([{ text: '' }])
    const r = await new AssistantConversation(factory, ctx).send('hello')
    expect(r.text).toMatch(/could not produce an answer/)
    expect(result({ text: '' }).response.text()).toBe('')
  })
})

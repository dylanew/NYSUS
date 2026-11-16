/**
 * Runs the assistant loop through the *real* firebase/ai SDK (ChatSession, request building,
 * response parsing). Only fetch is faked; no credentials or live Gemini calls are involved.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAI, GoogleAIBackend } from 'firebase/ai'
import { createAssistantModel } from '../../src/services/ai/firebaseAI'
import { AssistantConversation } from '../../src/services/ai/cloudAssistant'
import { contextFor, sessionFor } from '../helpers/assistantFixtures'

let app: FirebaseApp | null = null
afterEach(async () => {
  vi.restoreAllMocks()
  delete (globalThis as { LanguageModel?: unknown }).LanguageModel
  if (app) await deleteApp(app)
  app = null
})

const reply = (parts: object[]) =>
  new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP', index: 0 }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('cloud assistant through the real Firebase AI Logic SDK', () => {
  it('sends tool declarations and the system prompt, then returns function responses in the same chat', async () => {
    // Even with an on-device model available, the assistant must go to the cloud.
    const prompt = vi.fn()
    ;(globalThis as { LanguageModel?: unknown }).LanguageModel = { availability: async () => 'available', create: async () => ({ prompt }) }
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply([{ functionCall: { name: 'get_playback_metrics', args: {} } }]))
      .mockResolvedValueOnce(reply([{ text: 'Buffering is the issue.' }]))

    app = initializeApp({ apiKey: 'test-key', projectId: 'test-project', appId: '1:1:web:1' }, 'assistant-sdk')
    const assistant = createAssistantModel(getAI(app, { backend: new GoogleAIBackend() }), 'gemini-test-model')
    const { session, engine } = sessionFor([['poor', 40]])
    const r = await new AssistantConversation(assistant.startChat, contextFor(session, { engine })).send('Why is it buffering?')

    expect(r.text).toBe('Buffering is the issue.')
    expect(r.inferenceSource).toBe('in_cloud')
    expect(prompt).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    const [url, init] = fetchSpy.mock.calls[0]!
    expect(String(url)).toContain('gemini-test-model:generateContent')
    const first = JSON.parse(String((init as RequestInit).body))
    expect(first.tools[0].functionDeclarations.map((d: { name: string }) => d.name)).toHaveLength(6)
    expect(first.systemInstruction.parts[0].text).toMatch(/NYSUS streaming assistant/)
    expect(first.toolConfig.functionCallingConfig.mode).toBe('AUTO')

    const second = JSON.parse(String((fetchSpy.mock.calls[1]![1] as RequestInit).body))
    const roles = second.contents.map((c: { role: string }) => c.role)
    expect(roles).toEqual(['user', 'model', 'user'])
    const fr = second.contents[2].parts[0].functionResponse
    expect(fr.name).toBe('get_playback_metrics')
    expect(fr.response.sessionId).toBe('s1')
    expect(typeof fr.response.bufferingRatioPct).toBe('number')
    // The SDK's internal `type` discriminator is not sent over the wire.
    expect(second.contents[2].parts[0].type).toBeUndefined()
  })
})

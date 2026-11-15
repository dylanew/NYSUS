/**
 * Exercises the *real* firebase/ai SDK routing with our model configuration.
 * Chrome's Prompt API (window.LanguageModel) and the network are faked; no credentials
 * or live Gemini calls are involved. The fake Firebase options below exist only in this test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAI, GoogleAIBackend } from 'firebase/ai'
import { createPreferenceModels } from '../../src/services/ai/firebaseAI'
import { extractPreferences } from '../../src/services/ai/hybridInference'
import { preferenceJsonSchema } from '../../src/services/ai/schemas'
import { probeOnDeviceAvailability } from '../../src/services/ai/onDeviceAvailability'
import { VALID_JSON } from './fakeModel'

const g = globalThis as { LanguageModel?: unknown }
let app: FirebaseApp | null = null
let n = 0

function setup() {
  app = initializeApp({ apiKey: 'test-key', projectId: 'test-project', appId: '1:1:web:1' }, `test-${n++}`)
  return createPreferenceModels(getAI(app, { backend: new GoogleAIBackend() }))
}

function fakeLanguageModel(status: string) {
  const prompt = vi.fn(async (_c: unknown, _o: unknown) => VALID_JSON)
  const create = vi.fn(async () => ({ prompt, destroy: () => {} }))
  return { availability: vi.fn(async () => status), create, prompt }
}

function mockCloud() {
  const body = { candidates: [{ content: { role: 'model', parts: [{ text: VALID_JSON }] }, finishReason: 'STOP', index: 0 }] }
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}

afterEach(async () => {
  vi.restoreAllMocks()
  delete g.LanguageModel
  if (app) await deleteApp(app)
  app = null
})

describe('Firebase AI Logic hybrid routing (real SDK)', () => {
  it('runs on-device with our JSON schema as responseConstraint when Chrome reports available', async () => {
    const lm = fakeLanguageModel('available')
    g.LanguageModel = lm
    const fetchSpy = mockCloud()
    const models = setup()

    const r = await extractPreferences('dark sci-fi', { hybrid: models.hybrid, cloudOnly: models.cloudOnly })

    expect(r.record.source).toBe('on_device')
    expect(lm.prompt).toHaveBeenCalledOnce()
    expect(lm.prompt.mock.calls[0]?.[1]).toEqual({ responseConstraint: preferenceJsonSchema })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falls back to Gemini in the cloud when the model is still downloadable', async () => {
    g.LanguageModel = fakeLanguageModel('downloadable')
    const fetchSpy = mockCloud()
    const models = setup()

    const r = await extractPreferences('dark sci-fi', { hybrid: models.hybrid, cloudOnly: models.cloudOnly })

    expect(r.record.source).toBe('in_cloud')
    expect(r.record.onDeviceAvailability).toBe('downloadable')
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(String(url)).toContain('gemini-3.5-flash-lite:generateContent')
    const sent = JSON.parse(String((init as RequestInit).body))
    expect(sent.generationConfig.responseMimeType).toBe('application/json')
    expect(sent.generationConfig.responseJsonSchema).toEqual(preferenceJsonSchema)
  })

  it('uses the cloud when the browser has no Prompt API at all', async () => {
    mockCloud()
    const models = setup()
    const r = await extractPreferences('comedy', { hybrid: models.hybrid, cloudOnly: models.cloudOnly })
    expect(r.record.source).toBe('in_cloud')
    expect(await probeOnDeviceAvailability()).toBe('unsupported')
  })
  it('cloud only mode reaches Gemini even when Chrome reports available', async () => {
    const lm = fakeLanguageModel('available')
    g.LanguageModel = lm
    const fetchSpy = mockCloud()
    const models = setup()
    const r = await extractPreferences('x', { hybrid: models.hybrid, cloudOnly: models.cloudOnly }, { forceCloud: true })
    expect(r.record.source).toBe('in_cloud')
    expect(lm.prompt).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})

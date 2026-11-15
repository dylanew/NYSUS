import { describe, expect, it, vi } from 'vitest'
import { extractPreferences } from '../../src/services/ai/hybridInference'
import { StructuredOutputError } from '../../src/services/ai/schemas'
import { fakeModel, VALID_JSON } from './fakeModel'

const base = { currentYear: 2026 }

describe('extractPreferences', () => {
  it('records on_device when the SDK reports it', async () => {
    const hybrid = fakeModel(VALID_JSON, 'on_device')
    const cloudOnly = fakeModel(VALID_JSON, 'in_cloud')
    const r = await extractPreferences('dark sci-fi', { ...base, hybrid, cloudOnly, probe: async () => 'available' })
    expect(r.record.source).toBe('on_device')
    expect(r.record.onDeviceAvailability).toBe('available')
    expect(r.preferences.genres).toEqual(['science fiction'])
    expect(cloudOnly.generateContent).not.toHaveBeenCalled()
    expect(hybrid.generateContent.mock.calls[0]?.[0]).toContain('dark sci-fi')
    expect(hybrid.generateContent.mock.calls[0]?.[0]).toContain('2026')
  })

  it('records in_cloud fallback when the local model is unavailable', async () => {
    const r = await extractPreferences('dark sci-fi', {
      ...base,
      hybrid: fakeModel(VALID_JSON, 'in_cloud'),
      cloudOnly: fakeModel(VALID_JSON, 'in_cloud'),
      probe: async () => 'unsupported',
    })
    expect(r.record.source).toBe('in_cloud')
    expect(r.record.onDeviceAvailability).toBe('unsupported')
  })

  it('retries in the cloud when the on-device call throws', async () => {
    const hybrid = { generateContent: vi.fn(async () => { throw new Error('session crashed') }) }
    const cloudOnly = fakeModel(VALID_JSON, 'in_cloud')
    const r = await extractPreferences('dark sci-fi', { ...base, hybrid, cloudOnly, probe: async () => 'available' })
    expect(r.record.source).toBe('in_cloud')
    expect(r.record.onDeviceError).toBe('session crashed')
    expect(cloudOnly.generateContent).toHaveBeenCalledOnce()
  })

  it('does not mask cloud errors when on-device was never in play', async () => {
    const hybrid = { generateContent: vi.fn(async () => { throw new Error('App Check token invalid') }) }
    const cloudOnly = fakeModel(VALID_JSON, 'in_cloud')
    await expect(
      extractPreferences('x', { ...base, hybrid, cloudOnly, probe: async () => 'unavailable' }),
    ).rejects.toThrow('App Check token invalid')
    expect(cloudOnly.generateContent).not.toHaveBeenCalled()
  })

  it('refuses to guess when the SDK reports no inference source', async () => {
    await expect(
      extractPreferences('x', { ...base, hybrid: fakeModel(VALID_JSON), cloudOnly: fakeModel(VALID_JSON), probe: async () => 'unsupported' }),
    ).rejects.toThrow(/did not report an inference source/)
  })

  it('surfaces invalid structured output', async () => {
    await expect(
      extractPreferences('x', { ...base, hybrid: fakeModel('{"genres": "oops"}', 'on_device'), cloudOnly: fakeModel(''), probe: async () => 'available' }),
    ).rejects.toBeInstanceOf(StructuredOutputError)
  })

  it('validates input before calling any model', async () => {
    const hybrid = fakeModel(VALID_JSON, 'on_device')
    const deps = { ...base, hybrid, cloudOnly: fakeModel(VALID_JSON), probe: async () => 'available' as const }
    await expect(extractPreferences('   ', deps)).rejects.toThrow(/Describe/)
    await expect(extractPreferences('a'.repeat(501), deps)).rejects.toThrow(/under 500/)
    expect(hybrid.generateContent).not.toHaveBeenCalled()
  })
})

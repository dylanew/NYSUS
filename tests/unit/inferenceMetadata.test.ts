import { describe, expect, it } from 'vitest'
import { describeInference } from '../../src/services/ai/inferenceMetadata'
import { explainError } from '../../src/services/ai/errors'
import { probeOnDeviceAvailability } from '../../src/services/ai/onDeviceAvailability'

describe('describeInference', () => {
  it('only claims local processing when the SDK reported on_device', () => {
    expect(describeInference({ source: 'on_device', onDeviceAvailability: 'available' }).label).toBe('Processed on your device')
    expect(describeInference({ source: 'in_cloud', onDeviceAvailability: 'available' }).label).toBe('Processed using cloud AI')
  })

  it('explains cloud fallback reasons', () => {
    expect(describeInference({ source: 'in_cloud', onDeviceAvailability: 'unsupported' }).label).toBe('Local model unavailable — using cloud fallback')
    expect(describeInference({ source: 'in_cloud', onDeviceAvailability: 'downloading' }).tone).toBe('fallback')
    expect(describeInference({ source: 'in_cloud', onDeviceAvailability: 'available', onDeviceError: 'boom' }).label).toMatch(/failed/)
  })
})

describe('explainError', () => {
  it('flags browser-level fetch failures', () => {
    expect(explainError('AI: Error fetching from https://x: Type error (AI/error)')).toMatch(/blocked or dropped/)
    expect(explainError('Firebase App Check token is invalid.')).toMatch(/debug token/)
    expect(explainError('other')).toBe('other')
  })
})

describe('probeOnDeviceAvailability', () => {
  it('returns unsupported without the Prompt API', async () => {
    expect(await probeOnDeviceAvailability({})).toBe('unsupported')
  })
  it('passes through known Chrome statuses', async () => {
    expect(await probeOnDeviceAvailability({ LanguageModel: { availability: async () => 'downloadable' } })).toBe('downloadable')
  })
  it('maps unknown statuses and errors to unavailable', async () => {
    expect(await probeOnDeviceAvailability({ LanguageModel: { availability: async () => 'weird' } })).toBe('unavailable')
    expect(await probeOnDeviceAvailability({ LanguageModel: { availability: async () => { throw new Error('x') } } })).toBe('unavailable')
  })
})

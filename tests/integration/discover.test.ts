import { describe, expect, it, vi } from 'vitest'
import { discover } from '../../src/services/recommendations/discover'
import { fakeModel } from './fakeModel'

const nanoOutput = JSON.stringify({
  genres: [], moods: ['light-hearted'], preferredThemes: [], excludeGenres: [],
  releaseAfter: 2020, releaseBefore: 2027, contentType: 'series', length: 'short', confidence: 0.7,
})

describe('discover (Journey A end to end)', () => {
  it('runs hybrid extraction, drops the invented period and ranks the catalogue', async () => {
    const deps = { hybrid: fakeModel(nanoOutput, 'on_device'), cloudOnly: fakeModel(nanoOutput, 'in_cloud'), probe: async () => 'available' as const }
    const r = await discover('A short, light-hearted series I can finish this weekend', deps, { currentYear: 2026 })
    expect(r.method).toBe('ai')
    expect(r.extraction?.record.source).toBe('on_device')
    expect(r.preferences.releaseAfter).toBeUndefined()
    expect(r.notes[0]).toMatch(/Ignored a release period/)
    expect(r.results[0]?.title.id).toBe('detectorists')
    expect(r.results.every((x) => x.title.type === 'series')).toBe(true)
  })

  it('uses the named title as a reference', async () => {
    const out = JSON.stringify({ genres: ['science fiction'], moods: ['dark', 'suspenseful'], preferredThemes: [], excludeGenres: [], contentType: 'any', length: 'any', confidence: 0.7 })
    const deps = { hybrid: fakeModel(out, 'in_cloud'), cloudOnly: fakeModel(out), probe: async () => 'unsupported' as const }
    const r = await discover('Something like Interstellar, but darker', deps, { currentYear: 2026 })
    expect(r.reference?.id).toBe('interstellar')
    expect(r.results.map((x) => x.title.id)).not.toContain('interstellar')
  })

  it('falls back to keyword matching, labelled, when AI fails', async () => {
    const deps = { hybrid: { generateContent: vi.fn(async () => { throw new Error('AI: Error fetching from https://x: [401 ] Firebase App Check token is invalid.') }) }, cloudOnly: fakeModel(''), probe: async () => 'unsupported' as const }
    const r = await discover('a funny comedy series', deps, { currentYear: 2026 })
    expect(r.method).toBe('keywords')
    expect(r.aiError).toMatch(/App Check/)
    expect(r.results.length).toBeGreaterThan(0)
  })

  it('works with no Firebase at all', async () => {
    const r = await discover('dark sci-fi', null, { currentYear: 2026 })
    expect(r.method).toBe('keywords')
    expect(r.aiError).toBe('Firebase is not configured.')
    expect(r.results[0]?.title.genres).toContain('science fiction')
  })

  it('rejects empty requests instead of falling back', async () => {
    await expect(discover('   ', null)).rejects.toThrow(/Describe/)
  })
})

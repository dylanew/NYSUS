import { describe, expect, it } from 'vitest'
import { hasTimeCue, sanitisePreferences } from '../../src/services/recommendations/guards'
import type { ViewerPreferences } from '../../src/services/ai/schemas'

const base: ViewerPreferences = {
  genres: ['comedy'], moods: ['light-hearted'], preferredThemes: [], excludeGenres: [],
  contentType: 'series', length: 'short', confidence: 0.7,
}

describe('hasTimeCue', () => {
  it.each([
    ['from the last ten years', true],
    ['a 90s thriller', true],
    ['something released after 2015', true],
    ['a recent sci-fi film', true],
    ['an old classic', true],
    ['A short, light-hearted series I can finish this weekend', false],
    ['Something like Interstellar, but darker', false],
  ])('%s → %s', (text, expected) => expect(hasTimeCue(text)).toBe(expected))
})

describe('sanitisePreferences', () => {
  it('drops a release period the request never mentioned (live Gemini Nano case)', () => {
    const { preferences, notes } = sanitisePreferences(
      'A short, light-hearted series I can finish this weekend',
      { ...base, releaseAfter: 2020, releaseBefore: 2027 },
      2026,
    )
    expect(preferences.releaseAfter).toBeUndefined()
    expect(preferences.releaseBefore).toBeUndefined()
    expect(notes[0]).toMatch(/2020–2027/)
  })

  it('keeps a requested period and clamps a future end year', () => {
    const { preferences } = sanitisePreferences('from the last ten years', { ...base, releaseAfter: 2016, releaseBefore: 2030 }, 2026)
    expect(preferences.releaseAfter).toBe(2016)
    expect(preferences.releaseBefore).toBeUndefined()
  })

  it('drops excluded genres unless the request rules something out', () => {
    expect(sanitisePreferences('a fun comedy', { ...base, excludeGenres: ['horror'] }, 2026).preferences.excludeGenres).toEqual([])
    expect(sanitisePreferences('a comedy, but not horror', { ...base, excludeGenres: ['horror'] }, 2026).preferences.excludeGenres).toEqual(['horror'])
  })

  it('never adds preferences', () => {
    const { preferences } = sanitisePreferences('anything', base, 2026)
    expect(preferences).toEqual(base)
  })
})

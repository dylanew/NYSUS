import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../../src/data/catalogue'
import { getTitle } from '../../src/services/catalogue/catalogue'
import { buildProfile, isShort, rankTitles, scoreTitle } from '../../src/services/recommendations/ranking'
import type { ViewerPreferences } from '../../src/services/ai/schemas'

const prefs = (p: Partial<ViewerPreferences>): ViewerPreferences => ({
  genres: [], moods: [], preferredThemes: [], excludeGenres: [], contentType: 'any', length: 'any', confidence: 1, ...p,
})

describe('ranking', () => {
  it('is deterministic', () => {
    const input = { preferences: prefs({ genres: ['science fiction'], moods: ['dark'] }) }
    expect(rankTitles(CATALOGUE, input)).toEqual(rankTitles(CATALOGUE, input))
  })

  it('explains matches using real metadata only', () => {
    const r = scoreTitle(getTitle('ex-machina')!, { preferences: prefs({ genres: ['sci-fi'], moods: ['tense'] }) })
    expect(r.explanation).toBe("Recommended because it's science fiction and the mood is tense.")
    expect(r.score).toBe(1)
  })

  it('applies hard filters for type and excluded genres', () => {
    const results = rankTitles(CATALOGUE, { preferences: prefs({ genres: ['thriller'], excludeGenres: ['horror'], contentType: 'film' }) })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.title.type === 'film' && !r.title.genres.includes('horror'))).toBe(true)
  })

  it('excludes the referenced title and favours similar ones', () => {
    const reference = getTitle('interstellar')!
    const results = rankTitles(CATALOGUE, { preferences: prefs({}), reference }, 5)
    expect(results.map((r) => r.title.id)).not.toContain('interstellar')
    expect(results[0]!.explanation).toMatch(/like Interstellar/)
  })

  it('scores release periods with a soft decay', () => {
    const p = prefs({ releaseAfter: 2016 })
    expect(scoreTitle(getTitle('arrival')!, { preferences: p }).score).toBe(1)
    expect(scoreTitle(getTitle('ex-machina')!, { preferences: p }).score).toBeCloseTo(0.6)
    expect(scoreTitle(getTitle('blade-runner')!, { preferences: p }).score).toBe(0)
  })

  it('classifies short titles', () => {
    expect(isShort(getTitle('chernobyl')!)).toBe(true)
    expect(isShort(getTitle('the-office-us')!)).toBe(false)
    expect(isShort(getTitle('gravity')!)).toBe(true)
  })

  it('uses a taste profile from saved titles', () => {
    const profile = buildProfile([{ title: getTitle('ted-lasso')!, watched: true }, { title: getTitle('schitts-creek')!, watched: false }])
    const top = rankTitles(CATALOGUE.filter((t) => !['ted-lasso', 'schitts-creek'].includes(t.id)), { preferences: prefs({}), profile }, 3)
    expect(top.every((r) => r.title.genres.includes('comedy'))).toBe(true)
    expect(top[0]!.explanation).toMatch(/you've saved other/)
  })
})

describe('ranking constraints', () => {
  const p = (x: Partial<ViewerPreferences>): ViewerPreferences => ({
    genres: [], moods: [], preferredThemes: [], excludeGenres: [], contentType: 'any', length: 'any', confidence: 1, ...x,
  })
  it('treats a stated period as a hard filter when the catalogue can satisfy it', () => {
    const results = rankTitles(CATALOGUE, { preferences: p({ genres: ['thriller'], releaseAfter: 2016 }) })
    expect(results.every((r) => r.title.year >= 2016)).toBe(true)
  })
  it('falls back to soft scoring when too few titles fit the period', () => {
    const results = rankTitles(CATALOGUE, { preferences: p({ genres: ['thriller'], releaseBefore: 1990 }) })
    expect(results.some((r) => r.title.year > 1990)).toBe(true)
  })
  it('never recommends on length or era alone', () => {
    const r = scoreTitle(getTitle('chernobyl')!, { preferences: p({ moods: ['light-hearted'], length: 'short' }) })
    expect(r.score).toBe(0)
  })
})

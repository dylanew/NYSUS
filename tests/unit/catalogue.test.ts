import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../../src/data/catalogue'
import { GENRES, MOODS, normaliseTerm, termSimilarity } from '../../src/services/catalogue/vocabulary'
import { findMentionedTitle, formatDuration, getTitle } from '../../src/services/catalogue/catalogue'

describe('catalogue data', () => {
  it('has a credible size and unique ids', () => {
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(30)
    expect(new Set(CATALOGUE.map((t) => t.id)).size).toBe(CATALOGUE.length)
  })

  it('only uses the controlled vocabulary', () => {
    for (const t of CATALOGUE) {
      for (const g of t.genres) expect(GENRES, `${t.id} genre ${g}`).toContain(g)
      for (const m of t.moods) expect(MOODS, `${t.id} mood ${m}`).toContain(m)
    }
  })

  it('has plausible years, durations and series metadata', () => {
    for (const t of CATALOGUE) {
      expect(t.year).toBeGreaterThanOrEqual(1900)
      expect(t.year).toBeLessThanOrEqual(2026)
      expect(t.duration).toBeGreaterThan(0)
      if (t.type === 'series') expect(t.episodes && t.seasons).toBeTruthy()
      expect(t.description.length).toBeGreaterThan(20)
    }
  })
})

describe('vocabulary', () => {
  it('maps common model phrasing onto catalogue terms', () => {
    expect(normaliseTerm('Sci-Fi')).toBe('science fiction')
    expect(normaliseTerm('feel-good')).toBe('heartwarming')
    expect(termSimilarity('psychological thriller', 'thriller')).toBe(0.5)
    expect(termSimilarity('scary', 'horror')).toBe(1)
    expect(termSimilarity('comedy', 'drama')).toBe(0)
  })
})

describe('findMentionedTitle', () => {
  it('finds a named title', () => {
    expect(findMentionedTitle('Something like Interstellar, but darker')?.id).toBe('interstellar')
  })
  it('prefers the longest matching title', () => {
    expect(findMentionedTitle('more like blade runner 2049 please')?.id).toBe('blade-runner-2049')
    expect(findMentionedTitle('similar to Blade Runner')?.id).toBe('blade-runner')
  })
  it('ignores leading "The" and does not match inside words', () => {
    expect(findMentionedTitle('like the martian')?.id).toBe('the-martian')
    expect(findMentionedTitle('a moonlit romance')).toBeUndefined()
  })
})

describe('formatDuration', () => {
  it('formats films and series', () => {
    expect(formatDuration(getTitle('interstellar')!)).toBe('2 h 49 min')
    expect(formatDuration(getTitle('chernobyl')!)).toBe('1 season · 5 episodes · about 6 h')
  })
})

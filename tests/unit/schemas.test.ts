import { describe, expect, it } from 'vitest'
import { parsePreferences, StructuredOutputError } from '../../src/services/ai/schemas'

const valid = {
  genres: ['Psychological Thriller'],
  moods: ['suspenseful', 'dark'],
  preferredThemes: ['complex plot'],
  excludeGenres: [],
  releaseAfter: 2016,
  contentType: 'film',
  confidence: 0.92,
}

describe('parsePreferences', () => {
  it('accepts valid output and normalises labels to lower case', () => {
    const p = parsePreferences(JSON.stringify(valid))
    expect(p.genres).toEqual(['psychological thriller'])
    expect(p.releaseAfter).toBe(2016)
    expect(p.releaseBefore).toBeUndefined()
  })

  it('strips markdown code fences', () => {
    expect(parsePreferences('```json\n' + JSON.stringify(valid) + '\n```').confidence).toBe(0.92)
  })

  it('rejects non-JSON', () => {
    expect(() => parsePreferences('Sure! Here are your preferences')).toThrow(StructuredOutputError)
  })

  it('rejects out-of-range confidence', () => {
    expect(() => parsePreferences(JSON.stringify({ ...valid, confidence: 3 }))).toThrow(/validation/)
  })

  it('rejects missing required fields', () => {
    const { moods: _omit, ...rest } = valid
    expect(() => parsePreferences(JSON.stringify(rest))).toThrow(StructuredOutputError)
  })

  it('rejects an inverted release period', () => {
    expect(() => parsePreferences(JSON.stringify({ ...valid, releaseAfter: 2020, releaseBefore: 2010 }))).toThrow(/releaseAfter/)
  })

  it('treats 0 or null years as "no preference" (seen from Gemini Nano)', () => {
    const p = parsePreferences(JSON.stringify({ ...valid, releaseAfter: 0, releaseBefore: null }))
    expect(p.releaseAfter).toBeUndefined()
    expect(p.releaseBefore).toBeUndefined()
  })

  it('still rejects implausible non-placeholder years', () => {
    expect(() => parsePreferences(JSON.stringify({ ...valid, releaseAfter: 16 }))).toThrow(StructuredOutputError)
  })

  it('rejects an unknown content type', () => {
    expect(() => parsePreferences(JSON.stringify({ ...valid, contentType: 'podcast' }))).toThrow(StructuredOutputError)
  })
})

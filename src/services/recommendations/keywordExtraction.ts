import type { ViewerPreferences } from '../ai/schemas'
import { GENRES, MOODS, knownPhrases, normaliseTerm } from '../catalogue/vocabulary'

const GENRE_SET = new Set<string>(GENRES)
const MOOD_SET = new Set<string>(MOODS)

/**
 * Deterministic fallback used only when no AI path is available (Firebase not configured,
 * offline, or both models failed). The UI labels results from this as keyword matching.
 */
export function extractPreferencesByKeywords(request: string, currentYear: number): ViewerPreferences {
  let text = ` ${request.toLowerCase()} `
  const genres = new Set<string>()
  const moods = new Set<string>()
  for (const phrase of knownPhrases()) {
    if (text.includes(` ${phrase} `) || text.includes(` ${phrase},`) || text.includes(` ${phrase}.`)) {
      const term = normaliseTerm(phrase)
      if (GENRE_SET.has(term)) genres.add(term)
      else if (MOOD_SET.has(term)) moods.add(term)
      text = text.replace(phrase, ' ')
    }
  }
  const tenYears = /last (ten|10) years|past decade/.test(request.toLowerCase())
  const recent = /\b(recent|new|latest)\b/i.test(request)
  return {
    genres: [...genres],
    moods: [...moods],
    preferredThemes: [],
    excludeGenres: [],
    releaseAfter: tenYears ? currentYear - 10 : recent ? currentYear - 5 : undefined,
    releaseBefore: undefined,
    contentType: /\b(series|show|tv)\b/i.test(request) ? 'series' : /\b(film|movie)\b/i.test(request) ? 'film' : 'any',
    length: /\b(short|quick|weekend|binge)\b/i.test(request) ? 'short' : /\b(long|epic)\b/i.test(request) ? 'long' : 'any',
    confidence: 0.3,
  }
}

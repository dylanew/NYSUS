import type { MediaTitle } from '../../types/media'
import { extractPreferences, type ExtractOptions, type ExtractionResult, type HybridDeps } from '../ai/hybridInference'
import { explainError } from '../ai/errors'
import type { ViewerPreferences } from '../ai/schemas'
import { allTitles, findMentionedTitle } from '../catalogue/catalogue'
import { sanitisePreferences } from './guards'
import { extractPreferencesByKeywords } from './keywordExtraction'
import { rankTitles, type Recommendation, type TasteProfile } from './ranking'

export interface DiscoveryResult {
  request: string
  /** "ai" when Firebase AI Logic extracted the preferences; "keywords" for the offline fallback. */
  method: 'ai' | 'keywords'
  extraction?: ExtractionResult
  /** Why AI was not used, when method is "keywords". */
  aiError?: string
  preferences: ViewerPreferences
  notes: string[]
  reference?: MediaTitle
  results: Recommendation[]
}

export interface DiscoverOptions extends ExtractOptions {
  profile?: TasteProfile
  currentYear?: number
  titles?: MediaTitle[]
}

/**
 * Journey A end to end: hybrid extraction → deterministic sanitising → deterministic ranking.
 * If no AI path is available the app still works, using a clearly labelled keyword fallback.
 */
export async function discover(request: string, deps: HybridDeps | null, options: DiscoverOptions = {}): Promise<DiscoveryResult> {
  if (!request.trim()) throw new Error('Describe what you would like to watch.')
  const currentYear = options.currentYear ?? new Date().getFullYear()
  const titles = options.titles ?? allTitles()

  let extraction: ExtractionResult | undefined
  let aiError: string | undefined
  let raw: ViewerPreferences
  if (deps) {
    try {
      extraction = await extractPreferences(request, { ...deps, currentYear }, options)
      raw = extraction.preferences
    } catch (err) {
      // Input validation errors are the user's to fix, not a reason to fall back.
      if (err instanceof Error && /Describe what you|under \d+ characters/.test(err.message)) throw err
      aiError = explainError(err instanceof Error ? err.message : String(err))
      raw = extractPreferencesByKeywords(request, currentYear)
    }
  } else {
    aiError = 'Firebase is not configured.'
    raw = extractPreferencesByKeywords(request, currentYear)
  }

  const { preferences, notes } = sanitisePreferences(request, raw, currentYear)
  const reference = findMentionedTitle(request, titles)
  const results = rankTitles(titles, { preferences, reference, profile: options.profile })

  return { request, method: extraction ? 'ai' : 'keywords', extraction, aiError, preferences, notes, reference, results }
}

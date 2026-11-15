import type { ViewerPreferences } from '../ai/schemas'

/**
 * Words that show the viewer actually asked about *when* something was made.
 * Seen live: Gemini Nano invented "2020–2027" for "a short, light-hearted series I can finish
 * this weekend". A release period is only honoured when the request contains one of these cues.
 */
const TIME_CUE =
  /\b(1[89]\d\d|20\d\d)s?\b|\b'?\d0s\b|\b(recent|recently|new|newer|newest|latest|modern|current|contemporary|old|older|classic|classics|vintage|retro|decade|decades|century|years?|nineties|eighties|seventies|sixties|noughties|era|released|came out)\b/i

export function hasTimeCue(request: string): boolean {
  return TIME_CUE.test(request)
}

export interface SanitisedPreferences {
  preferences: ViewerPreferences
  /** Human-readable notes about anything we discarded, shown in the UI. */
  notes: string[]
}

/**
 * Deterministic clean-up of model output before ranking. Never adds preferences;
 * only removes ones the request does not support.
 */
export function sanitisePreferences(request: string, prefs: ViewerPreferences, currentYear: number): SanitisedPreferences {
  const notes: string[] = []
  let { releaseAfter, releaseBefore } = prefs

  if ((releaseAfter !== undefined || releaseBefore !== undefined) && !hasTimeCue(request)) {
    notes.push(`Ignored a release period (${releaseAfter ?? 'any'}–${releaseBefore ?? 'now'}) the model added that your request didn't mention.`)
    releaseAfter = undefined
    releaseBefore = undefined
  }
  if (releaseBefore !== undefined && releaseBefore > currentYear) releaseBefore = undefined
  if (releaseAfter !== undefined && releaseAfter > currentYear) {
    notes.push(`Ignored a start year in the future (${releaseAfter}).`)
    releaseAfter = undefined
  }

  // A genre can't be both wanted and excluded; trust the exclusion only if the request says "not"/"no"/"without".
  const negates = /\b(not|no|without|avoid|nothing|except|but not|isn't|aren't)\b/i.test(request)
  const excludeGenres = negates ? prefs.excludeGenres : []
  if (!negates && prefs.excludeGenres.length > 0) {
    notes.push(`Ignored excluded genres (${prefs.excludeGenres.join(', ')}) because your request didn't rule anything out.`)
  }
  const genres = prefs.genres.filter((g) => !excludeGenres.includes(g))

  return { preferences: { ...prefs, genres, excludeGenres, releaseAfter, releaseBefore }, notes }
}

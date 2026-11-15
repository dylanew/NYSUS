/** Prompts are version-controlled and kept out of UI components. */
export const PROMPT_VERSION = 'preferences-v2'

export const PREFERENCE_EXTRACTION_SYSTEM = `You extract structured entertainment preferences from a viewer's request.
Return only JSON matching the provided schema.
- genres: genres the viewer wants, lower case (e.g. "science fiction", "psychological thriller").
- moods: emotional tone words (e.g. "dark", "suspenseful", "light-hearted").
- preferredThemes: subject matter or story traits (e.g. "complex plot", "space exploration").
- excludeGenres: genres the viewer explicitly does not want.
- releaseAfter / releaseBefore: four-digit years, only if the viewer implies a period. Otherwise leave the field out entirely; never use 0.
- contentType: "film", "series" or "any".
- confidence: 0 to 1, how clearly the request states its preferences.
Do not invent preferences the request does not express.`

export function preferenceExtractionPrompt(request: string, currentYear: number): string {
  return `${PREFERENCE_EXTRACTION_SYSTEM}

The current year is ${currentYear}.
Viewer request: """${request}"""`
}

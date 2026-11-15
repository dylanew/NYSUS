import { z } from 'zod'

/**
 * Viewer preferences extracted from a natural-language request.
 *
 * The same JSON Schema is sent to both inference paths:
 *  - on-device: onDeviceParams.promptOptions.responseConstraint (Chrome Prompt API)
 *  - in-cloud:  inCloudParams.generationConfig.responseJsonSchema (Gemini)
 * It is kept deliberately simple (no nulls, no unions) so both models can honour it.
 * Zod then validates whatever actually comes back; the model is never trusted.
 */
export const preferenceJsonSchema = {
  type: 'object',
  properties: {
    genres: { type: 'array', items: { type: 'string' } },
    moods: { type: 'array', items: { type: 'string' } },
    preferredThemes: { type: 'array', items: { type: 'string' } },
    excludeGenres: { type: 'array', items: { type: 'string' } },
    releaseAfter: { type: 'integer' },
    releaseBefore: { type: 'integer' },
    contentType: { type: 'string', enum: ['film', 'series', 'any'] },
    length: { type: 'string', enum: ['short', 'long', 'any'] },
    confidence: { type: 'number' },
  },
  required: ['genres', 'moods', 'preferredThemes', 'excludeGenres', 'contentType', 'length', 'confidence'],
} as const

const label = z.string().trim().min(1).max(60).transform((s) => s.toLowerCase())
/**
 * The small on-device model sometimes fills an optional year with 0 (or null) to mean
 * "no preference" instead of omitting it. Placeholders that cannot be a release year
 * are treated as absent; anything else must be a real four-digit year.
 */
const YEAR_PLACEHOLDERS = new Set<unknown>([null, 0, ''])
const year = z.preprocess(
  (v) => (YEAR_PLACEHOLDERS.has(v) ? undefined : v),
  z.number().int().min(1900).max(2100).optional(),
)

export const viewerPreferencesSchema = z
  .object({
    genres: z.array(label).max(10),
    moods: z.array(label).max(10),
    preferredThemes: z.array(label).max(10),
    excludeGenres: z.array(label).max(10),
    releaseAfter: year,
    releaseBefore: year,
    contentType: z.enum(['film', 'series', 'any']),
    // Optional on input so older/looser model output still validates; defaults to "any".
    length: z.enum(['short', 'long', 'any']).default('any'),
    confidence: z.number().min(0).max(1),
  })
  .refine((p) => p.releaseAfter === undefined || p.releaseBefore === undefined || p.releaseAfter <= p.releaseBefore, {
    message: 'releaseAfter must not be later than releaseBefore',
  })

export type ViewerPreferences = z.infer<typeof viewerPreferencesSchema>

export class StructuredOutputError extends Error {
  readonly raw: string
  constructor(message: string, raw: string) {
    super(message)
    this.name = 'StructuredOutputError'
    this.raw = raw
  }
}

/** Models occasionally wrap JSON in markdown fences; strip them before parsing. */
export function parsePreferences(raw: string): ViewerPreferences {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new StructuredOutputError('Model response was not valid JSON', raw)
  }
  const result = viewerPreferencesSchema.safeParse(data)
  if (!result.success) {
    throw new StructuredOutputError(`Model response failed validation: ${result.error.issues[0]?.message ?? 'unknown'}`, raw)
  }
  return result.data
}

import type { FunctionDeclaration } from 'firebase/ai'
import { z } from 'zod'

/**
 * Tool arguments. The model's function-call arguments are validated against these Zod
 * schemas before anything runs; `.strict()` rejects arguments we did not declare. The
 * matching JSON Schemas in TOOL_DECLARATIONS are what Gemini sees.
 */
const term = z.string().trim().min(1).max(40)
const year = z.number().int().min(1900).max(2100)

export const toolArgSchemas = {
  search_catalogue: z
    .object({
      query: z.string().trim().max(200).optional(),
      genres: z.array(term).max(5).optional(),
      moods: z.array(term).max(5).optional(),
      themes: z.array(term).max(5).optional(),
      excludeGenres: z.array(term).max(5).optional(),
      releasedAfter: year.optional(),
      releasedBefore: year.optional(),
      type: z.enum(['film', 'series', 'any']).optional(),
      maxResults: z.number().int().min(1).max(10).optional(),
    })
    .strict()
    .refine((a) => a.releasedAfter === undefined || a.releasedBefore === undefined || a.releasedAfter <= a.releasedBefore, {
      message: 'releasedAfter must not be later than releasedBefore',
    }),
  get_viewer_preferences: z.object({}).strict(),
  get_playback_metrics: z.object({ lastSeconds: z.number().int().min(10).max(3600).optional() }).strict(),
  analyse_buffering: z.object({ maxIncidents: z.number().int().min(1).max(20).optional() }).strict(),
  compare_network_conditions: z
    .object({
      splitBy: z.enum(['network_change', 'halves', 'window']).optional(),
      windowSeconds: z.number().int().min(10).max(600).optional(),
    })
    .strict(),
  generate_diagnostic_report: z.object({ focus: z.enum(['overall', 'buffering', 'errors', 'quality']).optional() }).strict(),
} as const

export type ToolName = keyof typeof toolArgSchemas
export const TOOL_NAMES = Object.keys(toolArgSchemas) as ToolName[]
export type ToolArgs<N extends ToolName> = z.infer<(typeof toolArgSchemas)[N]>

const strings = (description: string) => ({ type: 'array' as const, items: { type: 'string' as const }, description })

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'search_catalogue',
    description:
      'Search the NYSUS demonstration catalogue (about 40 films and series) and rank titles with the app\'s deterministic scoring. Use for any recommendation or "something like X" request. Returns only real catalogue titles with the criteria each one matched.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The viewer\'s request in their words, e.g. "like Interstellar but darker". Named titles and known genre/mood words are picked up from it.' },
        genres: strings('Genres to match, lower case, e.g. ["science fiction", "thriller"].'),
        moods: strings('Moods to match, e.g. ["dark", "suspenseful"].'),
        themes: strings('Themes or story traits, e.g. ["space exploration", "complex plot"].'),
        excludeGenres: strings('Genres the viewer does not want.'),
        releasedAfter: { type: 'integer', description: 'Earliest release year.' },
        releasedBefore: { type: 'integer', description: 'Latest release year.' },
        type: { type: 'string', enum: ['film', 'series', 'any'] },
        maxResults: { type: 'integer', description: '1 to 10, default 5.' },
      },
    },
  },
  {
    name: 'get_viewer_preferences',
    description:
      'Get the viewer\'s taste as recorded by NYSUS: favourite genres and moods, preferred release periods, watched titles and the watchlist. Derived from titles saved in this browser.',
  },
  {
    name: 'get_playback_metrics',
    description:
      'Get calculated statistics for the current playback session: recorded and observed time, buffering time and ratio, average and range of throughput, average bitrate and latency, playback errors and quality changes with event ids, current status. Also says whether the data is simulated or a live measurement.',
    parameters: {
      type: 'object',
      properties: { lastSeconds: { type: 'integer', description: 'Only the most recent N seconds of the session (10 to 3600). Omit for the whole session.' } },
    },
  },
  {
    name: 'analyse_buffering',
    description:
      'Investigate each buffering event in the current session: start/end event ids, timestamps, durations, throughput vs bitrate at the stall, latency, related network or quality changes in the 10 s before, and observed contributing factors and patterns. Factors are correlations, not proof.',
    parameters: { type: 'object', properties: { maxIncidents: { type: 'integer', description: '1 to 20, default 10. The most recent incidents are kept.' } } },
  },
  {
    name: 'compare_network_conditions',
    description:
      'Compare playback across periods of the session: throughput, throughput variability, latency, buffering, errors and quality changes per period, plus the difference between the best and worst periods. By default periods are split where the network condition changed, or into halves if it never changed.',
    parameters: {
      type: 'object',
      properties: {
        splitBy: { type: 'string', enum: ['network_change', 'halves', 'window'], description: 'How to split the session into periods.' },
        windowSeconds: { type: 'integer', description: 'Period length for splitBy "window" (10 to 600, default 30).' },
      },
    },
  },
  {
    name: 'generate_diagnostic_report',
    description:
      'Build the structured diagnostic report for the current session from the deterministic diagnostics: problem summary, most likely explanation, supporting evidence with event ids, confidence, recommended actions and limitations. Call this after investigating with the other playback tools, then explain the report to the viewer.',
    parameters: { type: 'object', properties: { focus: { type: 'string', enum: ['overall', 'buffering', 'errors', 'quality'] } } },
  },
]

/** What the activity indicator says while a tool runs. */
export const TOOL_LABELS: Record<ToolName, string> = {
  search_catalogue: 'Searching the catalogue',
  get_viewer_preferences: 'Reading your viewing preferences',
  get_playback_metrics: 'Checking playback metrics',
  analyse_buffering: 'Investigating buffering events',
  compare_network_conditions: 'Comparing network conditions',
  generate_diagnostic_report: 'Writing the diagnostic report',
}

export function isToolName(name: string): name is ToolName {
  return Object.prototype.hasOwnProperty.call(toolArgSchemas, name)
}

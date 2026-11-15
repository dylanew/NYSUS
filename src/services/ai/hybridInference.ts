import type { GenerateContentResult, InferenceSource } from 'firebase/ai'
import type { InferenceRecord } from './inferenceMetadata'
import { probeOnDeviceAvailability, type OnDeviceAvailability } from './onDeviceAvailability'
import { PROMPT_VERSION, preferenceExtractionPrompt } from './prompts'
import { parsePreferences, type ViewerPreferences } from './schemas'

/** The subset of GenerativeModel this service needs; lets tests inject fakes. */
export interface TextModel {
  generateContent(request: string): Promise<GenerateContentResult>
}

export interface HybridDeps {
  hybrid: TextModel
  cloudOnly: TextModel
  probe?: () => Promise<OnDeviceAvailability>
  now?: () => number
  currentYear?: number
}

export interface ExtractionResult {
  preferences: ViewerPreferences
  record: InferenceRecord
  raw: string
}

export const MAX_REQUEST_LENGTH = 500

let counter = 0
const nextId = () => `inf_${Date.now().toString(36)}_${(counter++).toString(36)}`

/**
 * Workflow A: single-turn structured extraction through Firebase AI Logic hybrid inference.
 * The SDK decides on-device vs cloud; we record what it reports in response.inferenceSource.
 */
export async function extractPreferences(request: string, deps: HybridDeps): Promise<ExtractionResult> {
  const text = request.trim()
  if (!text) throw new Error('Describe what you would like to watch.')
  if (text.length > MAX_REQUEST_LENGTH) throw new Error(`Keep requests under ${MAX_REQUEST_LENGTH} characters.`)

  const now = deps.now ?? (() => performance.now())
  const availability = await (deps.probe ?? probeOnDeviceAvailability)()
  const prompt = preferenceExtractionPrompt(text, deps.currentYear ?? new Date().getFullYear())
  const started = now()

  let result: GenerateContentResult
  let onDeviceError: string | undefined
  try {
    result = await deps.hybrid.generateContent(prompt)
  } catch (err) {
    // Only retry in the cloud if the on-device path was the one that failed.
    if (availability !== 'available') throw err
    onDeviceError = err instanceof Error ? err.message : String(err)
    result = await deps.cloudOnly.generateContent(prompt)
  }

  const source: InferenceSource | undefined = onDeviceError ? 'in_cloud' : result.response.inferenceSource
  // Never guess: if the SDK did not report a source, surface that as an error.
  if (!source) throw new Error('Firebase AI Logic did not report an inference source for this response.')
  const raw = result.response.text()
  const preferences = parsePreferences(raw)

  return {
    preferences,
    raw,
    record: {
      id: nextId(),
      task: 'extract_preferences',
      source,
      onDeviceAvailability: availability,
      onDeviceError,
      latencyMs: Math.round(now() - started),
      promptVersion: PROMPT_VERSION,
      at: Date.now(),
    },
  }
}

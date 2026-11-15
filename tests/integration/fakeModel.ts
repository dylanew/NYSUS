import type { GenerateContentResult, InferenceSource } from 'firebase/ai'
import { vi } from 'vitest'

/** Builds a fake GenerateContentResult shaped like the Firebase AI Logic SDK's. */
export function fakeResult(text: string, inferenceSource?: InferenceSource): GenerateContentResult {
  return { response: { text: () => text, inferenceSource } } as unknown as GenerateContentResult
}

export function fakeModel(text: string, source?: InferenceSource) {
  return { generateContent: vi.fn(async (_prompt: string) => fakeResult(text, source)) }
}

export const VALID_JSON = JSON.stringify({
  genres: ['science fiction'],
  moods: ['dark', 'suspenseful'],
  preferredThemes: ['space exploration'],
  excludeGenres: [],
  contentType: 'film',
  confidence: 0.8,
})

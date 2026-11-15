/**
 * Read-only probe of Chrome's Prompt API. The Firebase SDK makes the actual
 * routing decision; this only lets the UI explain *why* a request went where it did.
 */
export type OnDeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported'

export const ON_DEVICE_CREATE_OPTIONS = {
  expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
}

interface LanguageModelLike {
  availability(options?: unknown): Promise<string>
}

export async function probeOnDeviceAvailability(
  globalObj: { LanguageModel?: LanguageModelLike } = globalThis as { LanguageModel?: LanguageModelLike },
): Promise<OnDeviceAvailability> {
  const lm = globalObj.LanguageModel
  if (!lm || typeof lm.availability !== 'function') return 'unsupported'
  try {
    const status = await lm.availability(ON_DEVICE_CREATE_OPTIONS)
    if (status === 'available' || status === 'downloadable' || status === 'downloading' || status === 'unavailable') {
      return status
    }
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}

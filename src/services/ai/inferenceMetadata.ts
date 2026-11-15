import type { InferenceSource } from 'firebase/ai'
import type { OnDeviceAvailability } from './onDeviceAvailability'

/**
 * What actually happened for one hybrid request. `source` comes from the SDK's
 * response.inferenceSource ("on_device" | "in_cloud"), never from our own guess.
 */
export interface InferenceRecord {
  id: string
  task: 'extract_preferences'
  source: InferenceSource
  /** The mode this request asked for. `only_in_cloud` means the user chose to skip on-device. */
  requestedMode: 'prefer_on_device' | 'only_in_cloud'
  /** Availability of Chrome's on-device model at request time, probed separately. */
  onDeviceAvailability: OnDeviceAvailability
  /** Set when we fell back to cloud after the on-device call itself failed. */
  onDeviceError?: string
  latencyMs: number
  promptVersion: string
  at: number
}

export type InferenceTone = 'local' | 'cloud' | 'fallback'

export function describeInference(
  record: Pick<InferenceRecord, 'source' | 'onDeviceAvailability' | 'onDeviceError'> & Partial<Pick<InferenceRecord, 'requestedMode'>>,
): {
  tone: InferenceTone
  label: string
  detail: string
} {
  if (record.source === 'on_device') {
    return { tone: 'local', label: 'Processed on your device', detail: 'Chrome built-in model (Gemini Nano)' }
  }
  if (record.requestedMode === 'only_in_cloud') {
    return { tone: 'cloud', label: 'Processed using cloud AI', detail: 'Cloud only mode: on-device was skipped' }
  }
  if (record.onDeviceError) {
    return { tone: 'fallback', label: 'On-device model failed — used cloud AI', detail: record.onDeviceError }
  }
  switch (record.onDeviceAvailability) {
    case 'available':
      // Available but the SDK still routed to cloud (e.g. request not on-device compatible).
      return { tone: 'cloud', label: 'Processed using cloud AI', detail: 'Request routed to cloud by the SDK' }
    case 'downloadable':
    case 'downloading':
      return { tone: 'fallback', label: 'Local model not ready — using cloud fallback', detail: `On-device model is ${record.onDeviceAvailability}` }
    case 'unavailable':
      return { tone: 'fallback', label: 'Local model unavailable — using cloud fallback', detail: 'This device or browser cannot run the on-device model' }
    case 'unsupported':
      return { tone: 'fallback', label: 'Local model unavailable — using cloud fallback', detail: 'This browser has no Prompt API (Chrome 139+ desktop required)' }
  }
}

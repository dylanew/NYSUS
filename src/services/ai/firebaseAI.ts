import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type AI, type GenerativeModel } from 'firebase/ai'
import { getFirebase } from '../firebase/app'
import { ON_DEVICE_CREATE_OPTIONS } from './onDeviceAvailability'
import { preferenceJsonSchema } from './schemas'

/** Default in-cloud model used by the SDK for hybrid inference (firebase@13). */
export const DEFAULT_CLOUD_MODEL = 'gemini-3.5-flash-lite'

export interface PreferenceModels {
  /** PREFER_ON_DEVICE: Chrome Prompt API when available, otherwise Gemini in the cloud. */
  hybrid: GenerativeModel
  /**
   * ONLY_IN_CLOUD twin. Used only if the on-device call itself throws, because the SDK's
   * PREFER_ON_DEVICE mode falls back when the model is *unavailable*, not when a prompt fails.
   */
  cloudOnly: GenerativeModel
  cloudModelName: string
}

let ai: AI | null = null
let models: PreferenceModels | null = null

export function getFirebaseAI(): AI | null {
  if (ai) return ai
  const { services } = getFirebase()
  if (!services) return null
  ai = getAI(services.app, { backend: new GoogleAIBackend() })
  return ai
}

export function getPreferenceModels(): PreferenceModels | null {
  if (models) return models
  const instance = getFirebaseAI()
  if (!instance) return null
  models = createPreferenceModels(instance, getFirebase().services?.cloudModel ?? DEFAULT_CLOUD_MODEL)
  return models
}

/** Builds the hybrid + cloud-only model pair. Exported so integration tests exercise the real SDK config. */
export function createPreferenceModels(instance: AI, cloudModelName: string = DEFAULT_CLOUD_MODEL): PreferenceModels {
  const inCloudParams = {
    model: cloudModelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: preferenceJsonSchema,
      temperature: 0.2,
    },
  }

  return {
    hybrid: getGenerativeModel(instance, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams,
      onDeviceParams: {
        // The full instruction travels in the single-turn prompt so both paths see identical input.
        createOptions: ON_DEVICE_CREATE_OPTIONS,
        promptOptions: { responseConstraint: preferenceJsonSchema },
      },
    }),
    cloudOnly: getGenerativeModel(instance, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams }),
    cloudModelName,
  }
}

import { FunctionCallingMode, getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type AI, type Content, type GenerativeModel } from 'firebase/ai'
import { TOOL_DECLARATIONS } from '../assistant/toolSchemas'
import type { ChatFactory } from './cloudAssistant'
import { ASSISTANT_SYSTEM } from './prompts'
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
  // Limited-use (replay-protected) App Check tokens: AI Logic rejects standard
  // 1-hour tokens with "401 Firebase App Check token is invalid" when replay
  // protection is enforced, which we hit live on 15 Nov 2026.
  ai = getAI(services.app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })
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

// ── Workflow B: cloud assistant ─────────────────────────────────────────────

export interface AssistantModel {
  model: GenerativeModel
  modelName: string
  startChat: ChatFactory
}

/**
 * Cloud-only model with the six tool declarations. ONLY_IN_CLOUD on purpose: the on-device
 * model has no multi-turn chat or function calling. No functionReference is set, so the SDK
 * never runs tools by itself; cloudAssistant.ts runs the validated loop.
 */
export function createAssistantModel(instance: AI, modelName: string = DEFAULT_CLOUD_MODEL): AssistantModel {
  const model = getGenerativeModel(instance, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: modelName,
      generationConfig: { temperature: 0.3 },
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
      systemInstruction: ASSISTANT_SYSTEM,
    },
  })
  return { model, modelName, startChat: (history?: Content[]) => model.startChat({ history }) }
}

let assistant: AssistantModel | null = null

export function getAssistantModel(): AssistantModel | null {
  if (assistant) return assistant
  const instance = getFirebaseAI()
  if (!instance) return null
  const services = getFirebase().services
  assistant = createAssistantModel(instance, services?.assistantModel ?? services?.cloudModel ?? DEFAULT_CLOUD_MODEL)
  return assistant
}

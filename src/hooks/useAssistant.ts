import { useSyncExternalStore } from 'react'
import { getAssistantModel } from '../services/ai/firebaseAI'
import { createAssistantStore, type AssistantStore } from '../services/assistant/assistantStore'
import { createMockAssistantFactory } from '../services/ai/e2eMock'

let appStore: AssistantStore | null = null

/** One conversation for the whole app, so the drawer and the Assistant page share it. */
export function getAppAssistantStore(): AssistantStore {
  if (!appStore && import.meta.env.MODE === 'e2e') {
    // Playwright runs use a scripted Gemini through the real tool loop; removed from production builds.
    appStore = createAssistantStore({ factory: createMockAssistantFactory(), modelName: 'scripted test model' })
  }
  if (!appStore) {
    const model = getAssistantModel()
    appStore = createAssistantStore({ factory: model?.startChat ?? null, modelName: model?.modelName ?? null })
  }
  return appStore
}

export function useAssistant(store: AssistantStore = getAppAssistantStore()) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return { state, store }
}

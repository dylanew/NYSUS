import { useSyncExternalStore } from 'react'
import { getAssistantModel } from '../services/ai/firebaseAI'
import { createAssistantStore, type AssistantStore } from '../services/assistant/assistantStore'

let appStore: AssistantStore | null = null

/** One conversation for the whole app, so the drawer and the Assistant page share it. */
export function getAppAssistantStore(): AssistantStore {
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

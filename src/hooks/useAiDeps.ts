import { useMemo } from 'react'
import { getPreferenceModels } from '../services/ai/firebaseAI'
import type { HybridDeps } from '../services/ai/hybridInference'
import type { DeviceModelController } from './useOnDeviceModel'

/** Shared access to the hybrid + cloud-only preference models; null when Firebase isn't configured. */
export function useAiDeps(): { deps: HybridDeps | null; deviceModel: DeviceModelController | null } {
  return useMemo(() => {
    const models = getPreferenceModels()
    return {
      deps: models ? { hybrid: models.hybrid, cloudOnly: models.cloudOnly } : null,
      deviceModel: models?.hybrid ?? null,
    }
  }, [])
}

import { useCallback, useEffect, useState } from 'react'
import { probeOnDeviceAvailability, type OnDeviceAvailability } from '../services/ai/onDeviceAvailability'

export interface DeviceModelController {
  initializeDeviceModel(onProgress?: (p: number) => void): Promise<void>
}

/** Tracks Chrome's on-device model and lets the user start its download (needs a user gesture). */
export function useOnDeviceModel(model: DeviceModelController | null, probe = probeOnDeviceAvailability) {
  const [availability, setAvailability] = useState<OnDeviceAvailability | 'checking'>('checking')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => setAvailability(await probe()), [probe])

  useEffect(() => {
    let cancelled = false
    void probe().then((a) => {
      if (!cancelled) setAvailability(a)
    })
    return () => {
      cancelled = true
    }
  }, [probe])

  const prepare = useCallback(async () => {
    if (!model) return
    setError(null)
    setProgress(0)
    try {
      await model.initializeDeviceModel((p) => setProgress(p))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProgress(null)
      await refresh()
    }
  }, [model, refresh])

  return { availability, progress, error, prepare, refresh }
}

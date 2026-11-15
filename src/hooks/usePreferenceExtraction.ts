import { useCallback, useState } from 'react'
import { extractPreferences, type ExtractionResult, type HybridDeps } from '../services/ai/hybridInference'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: ExtractionResult }
  | { status: 'error'; message: string }

export function usePreferenceExtraction(deps: HybridDeps | null) {
  const [state, setState] = useState<State>({ status: 'idle' })

  const run = useCallback(
    async (request: string) => {
      if (!deps) {
        setState({ status: 'error', message: 'Firebase is not configured yet. See Settings.' })
        return
      }
      setState({ status: 'loading' })
      try {
        setState({ status: 'success', result: await extractPreferences(request, deps) })
      } catch (err) {
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    },
    [deps],
  )

  return { state, run }
}

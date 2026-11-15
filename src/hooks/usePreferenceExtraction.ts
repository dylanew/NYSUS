import { useCallback, useState } from 'react'
import { explainError } from '../services/ai/errors'
import { StructuredOutputError } from '../services/ai/schemas'
import { extractPreferences, type ExtractionResult, type ExtractOptions, type HybridDeps } from '../services/ai/hybridInference'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: ExtractionResult }
  | { status: 'error'; message: string; raw?: string }

export function usePreferenceExtraction(deps: HybridDeps | null) {
  const [state, setState] = useState<State>({ status: 'idle' })

  const run = useCallback(
    async (request: string, options?: ExtractOptions) => {
      if (!deps) {
        setState({ status: 'error', message: 'Firebase is not configured yet. See Settings.' })
        return
      }
      setState({ status: 'loading' })
      try {
        setState({ status: 'success', result: await extractPreferences(request, deps, options) })
      } catch (err) {
        setState({
          status: 'error',
          message: explainError(err instanceof Error ? err.message : String(err)),
          raw: err instanceof StructuredOutputError ? err.raw : undefined,
        })
      }
    },
    [deps],
  )

  return { state, run }
}

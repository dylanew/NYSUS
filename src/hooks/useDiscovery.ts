import { useCallback, useRef, useState } from 'react'
import type { HybridDeps } from '../services/ai/hybridInference'
import { StructuredOutputError } from '../services/ai/schemas'
import { discover, type DiscoverOptions, type DiscoveryResult } from '../services/recommendations/discover'
import { preferencesStore } from '../services/preferences/preferencesStore'

export type DiscoveryState =
  | { status: 'idle' }
  | { status: 'loading'; request: string }
  | { status: 'success'; result: DiscoveryResult }
  | { status: 'error'; message: string; raw?: string }

export function useDiscovery(deps: HybridDeps | null) {
  const [state, setState] = useState<DiscoveryState>({ status: 'idle' })
  const latest = useRef(0)

  const run = useCallback(
    async (request: string, options?: DiscoverOptions) => {
      const id = ++latest.current
      setState({ status: 'loading', request })
      try {
        const result = await discover(request, deps, options)
        if (id !== latest.current) return
        setState({ status: 'success', result })
        // Remember what the request was about (structured interests only, never the text).
        preferencesStore.record(result.preferences, result.extraction?.record.source ?? 'keywords')
      } catch (err) {
        if (id !== latest.current) return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          raw: err instanceof StructuredOutputError ? err.raw : undefined,
        })
      }
    },
    [deps],
  )

  return { state, run }
}

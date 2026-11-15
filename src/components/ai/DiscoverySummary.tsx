import { KeyRound } from 'lucide-react'
import type { DiscoveryResult } from '../../services/recommendations/discover'
import { InferenceBadge } from './InferenceBadge'
import { PreferenceResult } from './PreferenceResult'

/** What NYSUS understood, how it understood it, and anything it deliberately ignored. */
export function DiscoverySummary({ result }: { result: DiscoveryResult }) {
  return (
    <section aria-label="What NYSUS understood" className="space-y-4 rounded-2xl border border-ink-800 bg-ink-900 p-5">
      <div className="flex flex-wrap items-center gap-3">
        {result.extraction ? (
          <InferenceBadge record={result.extraction.record} />
        ) : (
          <div role="status" data-inference-source="keywords" className="inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/10 px-3 py-1 text-xs font-medium text-warn" title={result.aiError}>
            <KeyRound className="size-3.5" aria-hidden />
            AI unavailable — matched by keywords
          </div>
        )}
        {result.reference && <span className="text-xs text-ink-300">Using <strong className="text-ink-100">{result.reference.title}</strong> as a reference</span>}
      </div>
      {result.aiError && <p className="text-xs text-ink-500">{result.aiError}</p>}
      <PreferenceResult preferences={result.preferences} />
      {result.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-ink-500">
          {result.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}
      {result.extraction && (
        <details className="text-xs text-ink-500">
          <summary className="cursor-pointer">Raw model output</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-950 p-3">{result.extraction.raw}</pre>
        </details>
      )}
    </section>
  )
}

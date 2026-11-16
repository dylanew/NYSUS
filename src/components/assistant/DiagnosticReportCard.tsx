import { ClipboardList } from 'lucide-react'
import type { DiagnosticReport } from '../../services/assistant/tools'

const CONFIDENCE = { high: 'text-local border-local/40', medium: 'text-warn border-warn/40', low: 'text-ink-300 border-ink-700' } as const

/**
 * The structured report exactly as generate_diagnostic_report returned it. Every value on
 * this card comes from deterministic code, not from the model's wording.
 */
export function DiagnosticReportCard({ report }: { report: DiagnosticReport }) {
  return (
    <section className="space-y-3 rounded-xl border border-ink-700 bg-ink-950/60 p-4" aria-label="Diagnostic report">
      <header className="flex flex-wrap items-center gap-2">
        <ClipboardList className="size-4 text-accent-400" aria-hidden />
        <h3 className="text-sm font-semibold">Diagnostic report</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${CONFIDENCE[report.confidence]}`} title={report.confidenceReason}>
          {report.confidence} confidence
        </span>
        <span className="ml-auto text-[11px] text-ink-500">
          Session {report.sessionId} · {report.dataSource.kind === 'simulated' ? 'Simulated' : report.dataSource.kind === 'live' ? 'Live measurement' : 'Simulated + live'} · {report.recordedAt} recorded
        </span>
      </header>

      <div className="space-y-1 text-sm">
        <p className="font-medium text-ink-100">{report.problemSummary}</p>
        <p className="text-ink-300">
          <span className="text-xs uppercase tracking-wider text-ink-500">{report.explanationIsCorrelation ? 'Likely explanation (correlation) ' : 'Explanation '}</span>
          {report.mostLikelyExplanation}
        </p>
        <p className="text-xs text-ink-500">{report.confidenceReason}</p>
      </div>

      {report.supportingEvidence.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs uppercase tracking-wider text-ink-500">Evidence</h4>
          <ul className="space-y-1 text-xs text-ink-300">
            {report.supportingEvidence.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className={`shrink-0 self-start rounded px-1 text-[10px] uppercase ${e.kind === 'observed' ? 'bg-cloud/15 text-cloud' : 'bg-butter/15 text-butter'}`}>{e.kind}</span>
                <span className="min-w-0">
                  {e.statement}
                  {e.eventIds.map((id) => (
                    <code key={id} className="ml-1 text-[10px] text-ink-500">{id}</code>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-1 text-xs uppercase tracking-wider text-ink-500">Try this</h4>
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-300">
          {report.recommendedActions.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </div>

      <details className="text-xs text-ink-500">
        <summary className="cursor-pointer">Limitations</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {report.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </details>
    </section>
  )
}

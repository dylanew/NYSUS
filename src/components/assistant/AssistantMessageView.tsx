import { AlertTriangle, Cloud, ListChecks, ShieldCheck } from 'lucide-react'
import type { AssistantMessage } from '../../services/assistant/assistantStore'
import type { DiagnosticReport, searchCatalogue } from '../../services/assistant/tools'
import { DiagnosticReportCard } from './DiagnosticReportCard'
import { MessageText } from './MessageText'
import { RecommendationStrip } from './RecommendationStrip'
import { ToolActivityList } from './ToolActivityList'

const STOP_TEXT = {
  max_model_calls: 'Stopped at the step limit',
  max_tool_calls: 'Stopped at the tool-call limit',
  timeout: 'Stopped: time limit',
} as const

export function AssistantMessageView({ message }: { message: AssistantMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent-500/20 px-4 py-2 text-sm text-ink-100">{message.text}</p>
      </div>
    )
  }

  if (message.role === 'error') {
    return (
      <div role="alert" className="space-y-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-ink-100">
        <p className="flex gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          {message.text}
        </p>
        {message.activities && <ToolActivityList activities={message.activities} />}
      </div>
    )
  }

  const runs = message.toolRuns ?? []
  const report = runs.findLast((r) => r.name === 'generate_diagnostic_report')?.result as DiagnosticReport | { available: false } | undefined
  const search = runs.findLast((r) => r.name === 'search_catalogue')?.result as ReturnType<typeof searchCatalogue> | undefined
  const g = message.grounding
  const verified = message.citations?.filter((c) => c.verified) ?? []

  return (
    <article className="space-y-3 rounded-2xl rounded-bl-sm border border-ink-800 bg-ink-900 p-4" data-mode={message.mode}>
      <header className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
        {message.mode === 'rules' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-ink-700 px-2 py-0.5">
            <ListChecks className="size-3" aria-hidden /> Rules-based diagnosis, no AI
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-cloud/40 px-2 py-0.5 text-cloud" data-inference-source={message.inferenceSource}>
            <Cloud className="size-3" aria-hidden /> Cloud AI{message.inferenceSource && message.inferenceSource !== 'in_cloud' ? ` (${message.inferenceSource})` : ''}
          </span>
        )}
        {runs.length === 0 && message.mode === 'ai' && <span>No tools used for this reply</span>}
        {message.stopReason && <span className="text-warn">{STOP_TEXT[message.stopReason]}</span>}
      </header>

      {message.activities && message.activities.length > 0 && (
        <details open={message.mode === 'ai'} className="rounded-lg bg-ink-950/50 px-3 py-2">
          <summary className="cursor-pointer text-xs text-ink-500">
            {message.activities.length} tool call{message.activities.length === 1 ? '' : 's'}
          </summary>
          <div className="mt-2">
            <ToolActivityList activities={message.activities} />
          </div>
        </details>
      )}

      <MessageText text={message.text} verifiedIds={g?.evidenceEventIds} unverifiedIds={g?.unverifiedEventIds} />

      {report && report.available && <DiagnosticReportCard report={report} />}
      {search && <RecommendationStrip result={search} />}

      {(verified.length > 0 || (g && (g.unverifiedEventIds.length > 0 || g.unverifiedFigures.length > 0))) && (
        <footer className="space-y-1 border-t border-ink-800 pt-2 text-xs">
          {verified.length > 0 && (
            <details>
              <summary className="cursor-pointer text-ink-500">
                <ShieldCheck className="mr-1 inline size-3 text-local" aria-hidden />
                {verified.length} cited event{verified.length === 1 ? '' : 's'} checked against the telemetry
              </summary>
              <ul className="mt-1 space-y-0.5 text-ink-300">
                {verified.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <code className="shrink-0 text-accent-300">{c.id}</code>
                    <span className="shrink-0 tabular-nums text-ink-500">{c.at ?? ''}</span>
                    <span className="min-w-0">{c.description ?? 'From an earlier session'}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {g && g.unverifiedEventIds.length > 0 && (
            <p className="text-danger">Not found in any tool result: {g.unverifiedEventIds.join(', ')}. Treat these references with caution.</p>
          )}
          {g && g.unverifiedFigures.length > 0 && (
            <p className="text-warn">Figures not found in the tool results: {g.unverifiedFigures.join(', ')}.</p>
          )}
        </footer>
      )}
    </article>
  )
}

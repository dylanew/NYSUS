import { Ban, CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react'
import type { ToolActivity } from '../../services/ai/cloudAssistant'

const ICON = {
  running: { icon: LoaderCircle, cls: 'animate-spin text-accent-300' },
  done: { icon: CheckCircle2, cls: 'text-local' },
  error: { icon: CircleAlert, cls: 'text-warn' },
  rejected: { icon: Ban, cls: 'text-danger' },
} as const

/**
 * One row per real tool execution, in the order the model requested them. Rows are added
 * by the loop in cloudAssistant.ts as each call starts and finishes, so nothing here is a
 * decorative animation.
 */
export function ToolActivityList({ activities, live = false }: { activities: ToolActivity[]; live?: boolean }) {
  if (activities.length === 0) return null
  return (
    <ol className="space-y-1" aria-label="Tool activity" aria-live={live ? 'polite' : undefined}>
      {activities.map((a) => {
        const s = ICON[a.status]
        return (
          <li key={a.id} className="flex items-start gap-2 text-xs" data-tool={a.name} data-status={a.status}>
            <s.icon className={`mt-px size-3.5 shrink-0 ${s.cls}`} aria-hidden />
            <span className="min-w-0 text-ink-300">
              {a.label}
              {a.status === 'running' ? '…' : ''}
              {a.summary && <span className="text-ink-500"> · {a.summary}</span>}
              {a.error && <span className="block text-warn">{a.error}</span>}
            </span>
            <code className="ml-auto shrink-0 text-[10px] text-ink-500">{a.name}</code>
          </li>
        )
      })}
    </ol>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ListChecks, LoaderCircle, RotateCcw, Send, Square } from 'lucide-react'
import { useAssistant } from '../../hooks/useAssistant'
import { MAX_MESSAGE_LENGTH } from '../../services/ai/cloudAssistant'
import type { AssistantStore } from '../../services/assistant/assistantStore'
import { AssistantMessageView } from './AssistantMessageView'
import { ToolActivityList } from './ToolActivityList'
import { SUGGESTIONS } from './suggestions'


export function AssistantChat({ store, compact = false }: { store?: AssistantStore; compact?: boolean }) {
  const { state, store: s } = useAssistant(store)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const busy = state.pending !== null

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [state.messages.length, state.pending?.activities.length])

  const submit = (text: string) => {
    if (!text.trim() || busy) return
    setDraft('')
    void s.send(text)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(draft)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto ${compact ? 'px-4 py-4' : 'py-2'}`}>
        {state.messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-ink-300">
              Ask about what to watch, or why playback is struggling. Every number comes from the app's own tools, and you can see each tool as it runs.
            </p>
            {!state.available && (
              <div className="space-y-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
                <p>
                  The AI assistant needs Firebase AI Logic, which isn't configured here (<Link to="/settings" className="underline">Settings</Link>). You can still run the
                  same diagnostic tools without AI.
                </p>
              </div>
            )}
            <ul className="flex flex-wrap gap-2" aria-label="Suggested questions">
              {SUGGESTIONS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    disabled={busy || !state.available}
                    onClick={() => submit(q)}
                    className="rounded-full border border-ink-700 px-3 py-1.5 text-left text-xs text-ink-300 hover:border-accent-400 hover:text-ink-100 disabled:opacity-50"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.messages.map((m) => (
          <AssistantMessageView key={m.id} message={m} />
        ))}

        {state.pending && (
          <div className="space-y-2 rounded-2xl border border-ink-800 bg-ink-900 p-4" aria-busy="true">
            <ToolActivityList activities={state.pending.activities} live />
            <p className="flex items-center gap-2 text-xs text-ink-500" role="status">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              {state.pending.round === 0 ? 'Asking the cloud assistant…' : 'Reading the tool results…'}
            </p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className={`space-y-2 border-t border-ink-800 pt-3 ${compact ? 'px-4 pb-4' : ''}`}>
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <label htmlFor={compact ? 'assistant-input-drawer' : 'assistant-input'} className="sr-only">
            Message the streaming assistant
          </label>
          <textarea
            id={compact ? 'assistant-input-drawer' : 'assistant-input'}
            rows={compact ? 2 : 2}
            maxLength={MAX_MESSAGE_LENGTH}
            value={draft}
            disabled={!state.available}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit(draft)
              }
            }}
            placeholder={state.available ? 'Why is my stream buffering?' : 'AI assistant unavailable'}
            className="min-h-11 flex-1 resize-none rounded-xl border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-accent-400 focus:outline-none disabled:opacity-60"
          />
          {busy ? (
            <button type="button" onClick={() => s.stop()} className="inline-flex h-11 items-center gap-1 rounded-xl border border-ink-700 px-3 text-sm text-ink-300 hover:text-ink-100">
              <Square className="size-4" aria-hidden /> Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim() || !state.available}
              className="inline-flex h-11 items-center gap-1 rounded-xl bg-accent-500 px-4 text-sm font-medium text-cream hover:bg-accent-600 disabled:opacity-40"
            >
              <Send className="size-4" aria-hidden /> Send
            </button>
          )}
        </form>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
          <button type="button" onClick={() => s.runRulesDiagnosis()} disabled={busy} className="inline-flex items-center gap-1 hover:text-ink-100 disabled:opacity-50">
            <ListChecks className="size-3" aria-hidden /> Run diagnosis without AI
          </button>
          {state.messages.length > 0 && (
            <button type="button" onClick={() => s.reset()} className="inline-flex items-center gap-1 hover:text-ink-100">
              <RotateCcw className="size-3" aria-hidden /> New conversation
            </button>
          )}
          <span className="ml-auto">{state.modelName ? `Cloud model: ${state.modelName}` : 'No AI model'} · conversation is not saved</span>
        </div>
      </div>
    </div>
  )
}

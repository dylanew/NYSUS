import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { Maximize2, MessageSquare, X } from 'lucide-react'
import { useAssistant } from '../../hooks/useAssistant'
import { AssistantChat } from './AssistantChat'

/** The assistant, reachable from every page: a floating button and a slide-over panel. */
export function AssistantDrawer() {
  const { state, store } = useAssistant()
  const { pathname } = useLocation()
  const onAssistantPage = pathname.startsWith('/assistant')

  useEffect(() => {
    if (!state.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && store.setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.open, store])

  if (onAssistantPage) return null

  return (
    <>
      {!state.open && (
        <button
          type="button"
          onClick={() => store.setOpen(true)}
          className="fixed right-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full bg-accent-500 px-4 py-3 text-sm font-medium text-cream shadow-lg shadow-black/40 hover:bg-accent-600 md:right-6 md:bottom-6"
        >
          <MessageSquare className="size-4" aria-hidden />
          Ask NYSUS
          {state.pending && <span className="size-2 animate-pulse rounded-full bg-butter" aria-label="Working" />}
        </button>
      )}
      {state.open && (
        <aside
          role="dialog"
          aria-label="Streaming assistant"
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-ink-800 bg-ink-900 shadow-2xl shadow-black/60"
        >
          <header className="flex items-center gap-2 border-b border-ink-800 px-4 py-3">
            <MessageSquare className="size-4 text-accent-400" aria-hidden />
            <h2 className="font-medium">Streaming assistant</h2>
            <Link to="/assistant" onClick={() => store.setOpen(false)} className="ml-auto rounded-md p-1.5 text-ink-500 hover:text-ink-100" aria-label="Open full page">
              <Maximize2 className="size-4" aria-hidden />
            </Link>
            <button type="button" onClick={() => store.setOpen(false)} className="rounded-md p-1.5 text-ink-500 hover:text-ink-100" aria-label="Close assistant">
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1">
            <AssistantChat compact />
          </div>
        </aside>
      )}
    </>
  )
}

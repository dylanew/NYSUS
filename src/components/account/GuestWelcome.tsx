import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useAccount } from '../../hooks/useAccount'
import { readJson, safeLocalStorage, writeJson } from '../../services/persistence/localStorage'

const KEY = 'nysus.welcomeDismissed.v1'

/** First-visit note for guests and judges: no account needed, and a one-click demo profile. */
export function GuestWelcome() {
  const { state, store } = useAccount()
  const [dismissed, setDismissed] = useState(() => readJson(safeLocalStorage(), KEY) === true)
  if (dismissed || state.kind !== 'guest') return null
  const dismiss = () => {
    writeJson(safeLocalStorage(), KEY, true)
    setDismissed(true)
  }
  return (
    <section aria-label="Welcome" className="relative rounded-2xl border border-accent-500/30 bg-accent-500/10 p-5 pr-12">
      <h2 className="font-medium">You're exploring as a guest</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-300">
        No sign-up needed: everything works, and your watchlist and sessions are saved as you go. Load a demo profile to see personal recommendations straight away
        {state.canSignIn ? ', or continue with Google to keep your data across devices' : ''}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            store.loadDemoProfile()
            dismiss()
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-medium text-cream hover:bg-accent-600"
        >
          <Sparkles className="size-4" aria-hidden /> Load demo profile
        </button>
        {state.canSignIn && (
          <button
            type="button"
            disabled={state.busy}
            onClick={() => void store.signInWithGoogle()}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-100 hover:border-ink-500 disabled:opacity-50"
          >
            Continue with Google
          </button>
        )}
      </div>
      {state.error && <p role="alert" className="mt-2 text-xs text-danger">{state.error}</p>}
      <button type="button" onClick={dismiss} aria-label="Dismiss welcome" className="absolute top-3 right-3 rounded-md p-1.5 text-ink-500 hover:text-ink-100">
        <X className="size-4" aria-hidden />
      </button>
    </section>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { Cloud, HardDrive, LogIn, LogOut, Sparkles, Trash2, UserRound } from 'lucide-react'
import { useAccount } from '../../hooks/useAccount'
import { describeStorage, TONE_CLASS } from './storageLabel'

function Avatar({ name, photo }: { name: string | null; photo: string | null }) {
  if (photo) return <img src={photo} alt="" referrerPolicy="no-referrer" className="size-6 rounded-full" />
  if (name) return <span className="flex size-6 items-center justify-center rounded-full bg-accent-500 text-xs font-semibold text-cream">{name.slice(0, 1).toUpperCase()}</span>
  return <UserRound className="size-4" aria-hidden />
}

/** Header control: guest or Google account, where data is saved, and the account actions. */
export function AccountMenu() {
  const { state, store } = useAccount()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const storage = describeStorage(state)
  const name = state.kind === 'google' ? (state.user?.displayName ?? 'Signed in') : 'Guest'

  const close = () => {
    setOpen(false)
    setConfirmDelete(false)
  }

  useEffect(() => {
    if (!open) return
    const shut = () => {
      setOpen(false)
      setConfirmDelete(false)
    }
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && shut()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && shut()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-300 hover:bg-ink-850 hover:text-ink-100 disabled:opacity-50'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        className="inline-flex items-center gap-2 rounded-full border border-ink-700 py-1 pr-3 pl-1.5 text-sm text-ink-100 hover:border-ink-500"
      >
        <Avatar name={state.kind === 'google' ? state.user?.displayName ?? null : null} photo={state.kind === 'google' ? state.user?.photoURL ?? null : null} />
        <span className="max-w-32 truncate">{name}</span>
        <span className={`size-2 rounded-full ${TONE_CLASS[storage.tone]}`} aria-hidden />
        <span className="sr-only">Account menu. {storage.text}</span>
      </button>

      {open && (
        <div id={panelId} role="region" aria-label="Account" className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-ink-800 bg-ink-900 p-2 shadow-2xl shadow-black/60">
          <div className="px-3 py-2">
            <p className="font-medium">{state.kind === 'google' ? `Signed in as ${state.user?.displayName ?? 'Google user'}` : 'Exploring as a guest'}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-300" role="status">
              {storage.tone === 'local' ? <HardDrive className="size-3.5" aria-hidden /> : <Cloud className="size-3.5" aria-hidden />}
              {storage.text}
            </p>
            {state.storageNote && <p className="mt-1 text-xs text-ink-500">{state.storageNote}</p>}
            {state.kind === 'guest' && state.canSignIn && <p className="mt-1 text-xs text-ink-500">No account needed. Sign in to keep your watchlist across devices.</p>}
          </div>
          <div className="my-1 border-t border-ink-800" />
          {state.kind === 'guest' && state.canSignIn && (
            <button type="button" className={item} disabled={state.busy || state.phase === 'starting'} onClick={() => void store.signInWithGoogle()}>
              <LogIn className="size-4" aria-hidden /> {state.busy ? 'Signing in…' : 'Continue with Google'}
            </button>
          )}
          {state.kind === 'guest' && (
            <button
              type="button"
              className={item}
              onClick={() => {
                if (state.demoTitleIds.length) store.clearDemoProfile()
                else store.loadDemoProfile()
                close()
              }}
            >
              <Sparkles className="size-4" aria-hidden /> {state.demoTitleIds.length ? 'Remove demo profile' : 'Load demo profile'}
            </button>
          )}
          {state.kind === 'guest' && state.demoTitleIds.length > 0 && state.canSignIn && (
            <p className="px-3 pb-1 text-xs text-ink-500">Demo titles stay in guest mode. Signing in with Google keeps only what you added yourself.</p>
          )}
          {state.kind === 'google' && (
            <button type="button" className={item} disabled={state.busy} onClick={() => void store.signOut()}>
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          )}
          <button
            type="button"
            className={`${item} ${confirmDelete ? 'text-danger hover:text-danger' : ''}`}
            disabled={state.busy}
            onClick={() => {
              if (!confirmDelete) return setConfirmDelete(true)
              setConfirmDelete(false)
              void store.deleteMyData()
            }}
          >
            <Trash2 className="size-4" aria-hidden /> {confirmDelete ? 'Click again to delete everything' : 'Delete my saved data'}
          </button>
          {state.error && (
            <p role="alert" className="px-3 py-2 text-xs text-danger">
              {state.error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

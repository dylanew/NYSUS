import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { AlertTriangle } from 'lucide-react'

/** Shown instead of a blank screen when a page throws or its code fails to load. */
export function RouteError({ inline = false }: { inline?: boolean }) {
  const error = useRouteError()
  const status = isRouteErrorResponse(error) ? error.status : null
  // A deploy can replace the hashed chunk a stale tab asks for.
  const chunk = error instanceof Error && /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(error.message)
  const message = status === 404 ? 'This page does not exist.' : chunk ? 'Part of the app failed to load, probably because a new version was released.' : 'Something went wrong on this page.'
  const detail = error instanceof Error ? error.message : isRouteErrorResponse(error) ? error.statusText : null

  const body = (
    <section role="alert" className="mx-auto max-w-lg rounded-2xl border border-danger/40 bg-danger/10 p-6">
      <div className="flex items-center gap-2 text-danger">
        <AlertTriangle className="size-5" aria-hidden />
        <h1 className="font-semibold">{message}</h1>
      </div>
      {detail && !chunk && <p className="mt-2 text-sm break-words text-ink-300">{detail}</p>}
      <p className="mt-2 text-sm text-ink-300">Your watchlist and sessions are safe.</p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-medium text-cream hover:bg-accent-600">
          Reload
        </button>
        <Link to="/" className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-100 hover:border-ink-500">
          Go home
        </Link>
      </div>
    </section>
  )
  return inline ? body : <div className="flex min-h-screen items-center bg-ink-950 px-4 text-ink-100">{body}</div>
}

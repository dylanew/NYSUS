import { useState } from 'react'
import { Activity } from 'lucide-react'
import { checkServices, type ServiceCheck as Check } from '../../services/network/liveProbe'

/** One-off, real round-trip check to each service's website from the viewer's connection. */
export function ServiceCheck({ run = checkServices }: { run?: () => Promise<Check[]> }) {
  const [results, setResults] = useState<Check[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    try {
      setResults(await run())
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-500">Service response check</h2>
        <button
          type="button"
          onClick={go}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-ink-300 hover:text-ink-100 disabled:opacity-50"
        >
          <Activity className="size-3.5" aria-hidden />
          {busy ? 'Checking…' : results ? 'Check again' : 'Check services'}
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        Times a request from your browser to each service's website. It shows how quickly they answer from where you are, not how their video servers are
        performing, which no service publishes.
      </p>
      {results && (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Response time to each streaming service's website</caption>
          <thead className="text-left text-xs text-ink-500">
            <tr>
              <th scope="col" className="py-1 font-normal">Service</th>
              <th scope="col" className="py-1 text-right font-normal">First contact</th>
              <th scope="col" className="py-1 text-right font-normal">Typical response</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {results.map((r) => (
              <tr key={r.serviceId} className="border-t border-ink-800">
                <th scope="row" className="py-1.5 text-left font-normal text-ink-100">{r.label}</th>
                <td className="py-1.5 text-right text-ink-300">{r.reachable ? `${r.firstContactMs} ms` : 'Unreachable'}</td>
                <td className="py-1.5 text-right text-ink-300">{r.reachable ? `${r.responseMs} ms` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

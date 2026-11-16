import { Link } from 'react-router'
import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { BufferChart, ThroughputChart } from '../components/charts/ThroughputChart'
import { toChartPoints } from '../components/charts/chartData'
import { EventTimeline } from '../components/player/EventTimeline'
import { MetricTiles } from '../components/player/MetricTiles'
import { STATUS_LABEL } from '../components/player/labels'
import { usePlayer } from '../hooks/usePlayer'
import { getTitle } from '../services/catalogue/catalogue'
import { healthFindings, type Severity } from '../services/diagnostics/findings'
import { formatClock } from '../services/playback/metrics'
import { getScenario } from '../data/demoScenarios'
import { getService } from '../services/network/liveProbe'

const SEVERITY = {
  good: { icon: CheckCircle2, label: 'Healthy', cls: 'text-local' },
  warning: { icon: AlertTriangle, label: 'Warning', cls: 'text-warn' },
  critical: { icon: AlertOctagon, label: 'Critical', cls: 'text-danger' },
} satisfies Record<Severity, unknown>

export function StreamHealthPage() {
  const { state } = usePlayer()
  const session = state.session

  if (!session) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold md:text-3xl">Stream Health</h1>
        <p className="text-ink-300">
          No playback yet. <Link to="/player" className="text-accent-300 underline">Open the player</Link>, pick a network condition and press play.
        </p>
      </div>
    )
  }

  const { metrics, incidents, findings } = healthFindings(session)
  const points = toChartPoints(session)
  const title = getTitle(session.titleId)

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Stream Health</h1>
          <p className="text-sm text-ink-500">
            Session {session.id} · {title?.title} · {state.scenario === 'live' ? `Live measurement, latency to ${getService(state.live.serviceId).label}` : getScenario(state.scenario).label} · {formatClock(session.elapsedMs)} recorded
          </p>
        </div>
        <span className="rounded-full border border-ink-700 px-3 py-1 text-xs text-ink-300">{STATUS_LABEL[state.status]}</span>
      </header>

      <MetricTiles metrics={metrics} />

      <section aria-labelledby="findings" className="space-y-2">
        <h2 id="findings" className="text-sm font-medium uppercase tracking-wider text-ink-500">What we found</h2>
        <ul className="space-y-2">
          {findings.map((f) => {
            const s = SEVERITY[f.severity]
            return (
              <li key={f.title} className="flex gap-3 rounded-xl border border-ink-800 bg-ink-900 p-4">
                <s.icon className={`mt-0.5 size-5 shrink-0 ${s.cls}`} aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    <span className={`mr-2 text-xs uppercase tracking-wider ${s.cls}`}>{s.label}</span>
                    {f.title}
                  </p>
                  <p className="text-sm text-ink-300">{f.detail}</p>
                  {f.evidenceEventIds.length > 0 && (
                    <p className="text-xs text-ink-500">Evidence: {f.evidenceEventIds.map((id) => <code key={id} className="mr-1">{id}</code>)}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-ink-500">Findings come from fixed rules over the recorded telemetry. The streaming assistant in Phase 4 will investigate with the same data.</p>
      </section>

      <section className="space-y-3 rounded-2xl border border-ink-800 bg-ink-900 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Network vs video bitrate</h2>
          <p className="text-xs text-ink-500">Shaded bands are buffering. Stalls happen when the network line drops below the bitrate line for too long.</p>
        </div>
        {points.length > 1 ? <ThroughputChart points={points} incidents={incidents} /> : <p className="text-sm text-ink-500">Collecting samples…</p>}
        <h2 className="pt-2 font-medium">Buffered video</h2>
        {points.length > 1 && <BufferChart points={points} incidents={incidents} />}
        <details className="text-xs text-ink-300">
          <summary className="cursor-pointer text-ink-500">Show data table ({points.length} samples)</summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left tabular-nums">
              <thead className="text-ink-500">
                <tr><th className="py-1">Time</th><th>Throughput (Mbps)</th><th>Bitrate (Mbps)</th><th>Buffer (s)</th></tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.t} className="border-t border-ink-800"><td className="py-0.5">{formatClock(p.t * 1000)}</td><td>{p.throughput}</td><td>{p.bitrate}</td><td>{p.buffer}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-500">Event timeline</h2>
        <EventTimeline events={session.events} limit={40} />
      </section>
    </div>
  )
}

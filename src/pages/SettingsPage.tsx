import { useState } from 'react'
import { getFirebase, probeAppCheck, type AppCheckProbe } from '../services/firebase/app'
import { DEFAULT_CLOUD_MODEL } from '../services/ai/firebaseAI'

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink-800 py-3 text-sm">
      <span className="text-ink-300">{label}</span>
      <span className={ok ? 'text-ink-100' : 'text-warn'}>{value}</span>
    </div>
  )
}

export function SettingsPage() {
  const { config, services } = getFirebase()
  const [probe, setProbe] = useState<AppCheckProbe | 'running' | null>(null)
  const runProbe = async () => {
    setProbe('running')
    setProbe(await probeAppCheck())
  }
  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink-500">Firebase</h2>
      <Row label="Web app config" value={
          config.ok
            ? `Project ${config.options.projectId}`
            : config.invalid.length > 0
              ? `Hidden or non-ASCII characters in ${config.invalid.join(', ')}`
              : `Missing ${config.missing.join(', ')}`
        } ok={config.ok} />
      <Row
        label="App Check"
        value={services ? { 'recaptcha-enterprise': 'reCAPTCHA Enterprise', debug: 'Debug token (dev only)', disabled: 'Not configured' }[services.appCheckMode] : 'Not configured'}
        ok={services?.appCheckMode !== 'disabled' && !!services}
      />
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-800 py-3 text-sm">
        <button type="button" onClick={() => void runProbe()} className="rounded-md border border-ink-700 px-3 py-1 text-ink-100 hover:border-accent-400">
          Test App Check
        </button>
        <span role="status" className={probe && probe !== 'running' && !probe.ok ? 'text-danger' : 'text-ink-100'}>
          {probe === 'running' ? 'Requesting a token…' : probe === null ? '' : probe.ok ? 'App Check token issued ✓' : probe.reason}
        </span>
      </div>
      {probe && probe !== 'running' && probe.ok && (
        <dl className="space-y-1 border-b border-ink-800 py-3 text-xs text-ink-300" data-testid="appcheck-diagnostics">
          <div>Token app: <span className="text-ink-100">{probe.claims?.appId ?? 'unknown'}</span>{' '}
            {probe.claims?.appId && probe.claims.appId !== services?.app.options.appId && <span className="text-danger">(does not match this app's appId {services?.app.options.appId})</span>}
          </div>
          <div>Token audience: <span className="text-ink-100">{probe.claims?.audience.join(', ') || 'unknown'}</span></div>
          <div>Token expires: <span className="text-ink-100">{probe.claims?.expiresAt ?? 'unknown'}</span></div>
          <div>Cloud check: <span className={probe.cloud.includes('Limited-use token succeeded') ? 'text-local' : 'text-danger'}>{probe.cloud}</span></div>
        </dl>
      )}
      <Row label="Cloud model (fallback)" value={services?.cloudModel ?? DEFAULT_CLOUD_MODEL} ok />
      {!config.ok && (
        <p className="mt-6 text-sm text-ink-300">
          Copy <code className="text-ink-100">.env.example</code> to <code className="text-ink-100">.env.local</code>, fill in your Firebase web app config, and restart the dev server.
        </p>
      )}
    </section>
  )
}

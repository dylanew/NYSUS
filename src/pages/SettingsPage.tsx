import { getFirebase } from '../services/firebase/app'
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
      <Row label="Cloud model (fallback)" value={services?.cloudModel ?? DEFAULT_CLOUD_MODEL} ok />
      {!config.ok && (
        <p className="mt-6 text-sm text-ink-300">
          Copy <code className="text-ink-100">.env.example</code> to <code className="text-ink-100">.env.local</code>, fill in your Firebase web app config, and restart the dev server.
        </p>
      )}
    </section>
  )
}

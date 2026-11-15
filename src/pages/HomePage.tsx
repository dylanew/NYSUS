import { useMemo } from 'react'
import { Link } from 'react-router'
import { DiscoveryPrompt } from '../components/ai/DiscoveryPrompt'
import { getPreferenceModels } from '../services/ai/firebaseAI'
import { getFirebase } from '../services/firebase/app'

export function HomePage() {
  const models = useMemo(() => getPreferenceModels(), [])
  const deps = useMemo(() => (models ? { hybrid: models.hybrid, cloudOnly: models.cloudOnly } : null), [models])
  const { config } = getFirebase()

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Good to see you.</h1>
        <p className="mt-2 max-w-xl text-ink-300">Tell NYSUS what you feel like watching. It reads your request on this device when it can.</p>
      </section>

      {!config.ok && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Firebase isn't configured, so AI features are off. <Link to="/settings" className="underline">See Settings</Link> for what's needed.
        </p>
      )}

      <DiscoveryPrompt deps={deps} deviceModel={models?.hybrid ?? null} />

      <section>
        <h2 className="text-lg font-medium">Featured</h2>
        <p className="mt-1 text-sm text-ink-500">The catalogue and recommendations arrive in Phase 2.</p>
      </section>
    </div>
  )
}

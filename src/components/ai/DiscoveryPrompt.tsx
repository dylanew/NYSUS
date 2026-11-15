import { useState, type FormEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import type { HybridDeps } from '../../services/ai/hybridInference'
import { MAX_REQUEST_LENGTH } from '../../services/ai/hybridInference'
import { usePreferenceExtraction } from '../../hooks/usePreferenceExtraction'
import { useOnDeviceModel, type DeviceModelController } from '../../hooks/useOnDeviceModel'
import type { OnDeviceAvailability } from '../../services/ai/onDeviceAvailability'
import { InferenceBadge } from './InferenceBadge'
import { PreferenceResult } from './PreferenceResult'
import { DeviceModelStatus } from './DeviceModelStatus'

const EXAMPLES = [
  'Something like Interstellar, but darker and more suspenseful',
  'A psychological thriller with a clever plot from the last ten years',
  'A short, light-hearted series I can finish this weekend',
]

export function DiscoveryPrompt(props: {
  deps: HybridDeps | null
  deviceModel: DeviceModelController | null
  probe?: () => Promise<OnDeviceAvailability>
}) {
  const { state, run } = usePreferenceExtraction(props.deps)
  const device = useOnDeviceModel(props.deviceModel, props.probe)
  const [text, setText] = useState('')
  const [forceCloud, setForceCloud] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(text, { forceCloud }).then(() => device.refresh())
  }

  return (
    <div className="rounded-2xl border border-ink-800 bg-gradient-to-b from-ink-850 to-ink-900 p-5 md:p-6">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="discovery" className="sr-only">
          What would you like to watch?
        </label>
        <input
          id="discovery"
          value={text}
          maxLength={MAX_REQUEST_LENGTH}
          onChange={(e) => setText(e.target.value)}
          placeholder="What are you in the mood for?"
          className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-base placeholder:text-ink-500 focus:border-accent-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={state.status === 'loading' || !text.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 px-5 py-3 font-medium text-white transition-colors hover:bg-accent-500 disabled:opacity-50"
        >
          {state.status === 'loading' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {state.status === 'loading' ? 'Understanding…' : 'Understand my request'}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full border border-ink-800 px-3 py-1 text-xs text-ink-300 hover:border-ink-700 hover:text-ink-100">
            {ex}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <DeviceModelStatus
          availability={device.availability}
          progress={device.progress}
          error={device.error}
          onPrepare={() => void device.prepare()}
          canPrepare={props.deviceModel !== null}
        />
        <label className="flex items-center gap-2 text-xs text-ink-300">
          <input type="checkbox" checked={forceCloud} onChange={(e) => setForceCloud(e.target.checked)} className="accent-accent-500" />
          Cloud only
        </label>
      </div>

      {state.status === 'error' && (
        <div role="alert" className="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.message}
          {state.raw && (
            <details className="mt-2 text-xs text-ink-300">
              <summary className="cursor-pointer">What the model returned</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{state.raw}</pre>
            </details>
          )}
        </div>
      )}

      {state.status === 'success' && (
        <div className="mt-6 space-y-4 border-t border-ink-800 pt-5">
          <InferenceBadge record={state.result.record} />
          <PreferenceResult preferences={state.result.preferences} />
          <details className="text-xs text-ink-500">
            <summary className="cursor-pointer">Raw model output</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-950 p-3">{state.result.raw}</pre>
          </details>
        </div>
      )}
    </div>
  )
}

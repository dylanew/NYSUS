import { useState, type FormEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { MAX_REQUEST_LENGTH } from '../../services/ai/hybridInference'
import { useOnDeviceModel, type DeviceModelController } from '../../hooks/useOnDeviceModel'
import type { OnDeviceAvailability } from '../../services/ai/onDeviceAvailability'
import { DeviceModelStatus } from './DeviceModelStatus'
import { EXAMPLE_REQUESTS } from './examples'


export function DiscoveryForm(props: {
  onSubmit: (request: string, options: { forceCloud: boolean }) => void
  loading?: boolean
  initialValue?: string
  deviceModel: DeviceModelController | null
  probe?: () => Promise<OnDeviceAvailability>
  submitLabel?: string
}) {
  const device = useOnDeviceModel(props.deviceModel, props.probe)
  const [text, setText] = useState(props.initialValue ?? '')
  const [forceCloud, setForceCloud] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    props.onSubmit(text, { forceCloud })
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
          disabled={props.loading || !text.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 px-5 py-3 font-medium text-white transition-colors hover:bg-accent-500 disabled:opacity-50"
        >
          {props.loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {props.loading ? 'Finding matches…' : (props.submitLabel ?? 'Find something')}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLE_REQUESTS.map((ex) => (
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
    </div>
  )
}

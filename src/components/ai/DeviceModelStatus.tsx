import type { OnDeviceAvailability } from '../../services/ai/onDeviceAvailability'

const COPY: Record<OnDeviceAvailability | 'checking', string> = {
  checking: 'Checking for an on-device model…',
  available: 'On-device model ready',
  downloadable: 'On-device model can be downloaded',
  downloading: 'On-device model downloading',
  unavailable: 'On-device model unavailable on this device',
  unsupported: 'Browser has no on-device model (needs Chrome 139+ desktop)',
}

export function DeviceModelStatus(props: {
  availability: OnDeviceAvailability | 'checking'
  progress: number | null
  error: string | null
  onPrepare: () => void
  canPrepare: boolean
}) {
  const { availability, progress, error, onPrepare, canPrepare } = props
  const showButton = canPrepare && (availability === 'downloadable' || availability === 'downloading')
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-300">
      <span className={`size-2 rounded-full ${availability === 'available' ? 'bg-local' : 'bg-ink-500'}`} aria-hidden />
      <span data-testid="device-availability">{COPY[availability]}</span>
      {progress !== null && <span>{Math.round(progress * 100)}%</span>}
      {showButton && progress === null && (
        <button type="button" onClick={onPrepare} className="rounded-md border border-ink-700 px-2 py-1 text-ink-100 hover:border-accent-400">
          Prepare on-device model
        </button>
      )}
      {error && <span className="text-danger">{error}</span>}
    </div>
  )
}

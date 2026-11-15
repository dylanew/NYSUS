import { Cloud, Cpu, CloudOff } from 'lucide-react'
import { describeInference } from '../../services/ai/inferenceMetadata'
import type { InferenceRecord } from '../../services/ai/inferenceMetadata'

const toneStyles = {
  local: 'border-local/40 bg-local/10 text-local',
  cloud: 'border-cloud/40 bg-cloud/10 text-cloud',
  fallback: 'border-warn/40 bg-warn/10 text-warn',
} as const

const toneIcons = { local: Cpu, cloud: Cloud, fallback: CloudOff } as const

export function InferenceBadge({ record }: { record: InferenceRecord }) {
  const { tone, label, detail } = describeInference(record)
  const Icon = toneIcons[tone]
  return (
    <div
      role="status"
      data-inference-source={record.source}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${toneStyles[tone]}`}
      title={detail}
    >
      <Icon className="size-3.5" aria-hidden />
      <span>{label}</span>
      <span className="text-ink-500">· {record.latencyMs} ms</span>
    </div>
  )
}

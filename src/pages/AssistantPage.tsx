import { AssistantChat } from '../components/assistant/AssistantChat'
import { TOOL_LABELS } from '../services/assistant/toolSchemas'

export function AssistantPage() {
  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[32rem] flex-col gap-4 md:h-[calc(100dvh-8rem)]">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold md:text-3xl">AI Assistant</h1>
        <p className="text-sm text-ink-500">
          Gemini in the cloud plans the investigation; the app runs the tools ({Object.values(TOOL_LABELS).length}: {Object.keys(TOOL_LABELS).join(', ')}) and returns real
          numbers. Playback data is simulated unless you chose live mode.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <AssistantChat />
      </div>
    </div>
  )
}

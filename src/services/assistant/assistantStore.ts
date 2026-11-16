import type { InferenceSource } from 'firebase/ai'
import { allTitles, getTitle } from '../catalogue/catalogue'
import { AssistantConversation, type ChatFactory, type StopReason, type ToolActivity, type ToolRun, type TurnOptions } from '../ai/cloudAssistant'
import { explainError } from '../ai/errors'
import { getService } from '../network/liveProbe'
import { playerStore, type PlayerStore } from '../playback/playerStore'
import { watchlistStore, type WatchlistStore } from '../watchlist/watchlistStore'
import type { MediaTitle } from '../../types/media'
import type { ToolContext } from './context'
import { EVENT_ID_PATTERN, checkGrounding, type GroundingCheck } from './grounding'
import { describeEvent } from '../../components/player/labels'
import { formatClock } from '../playback/metrics'
import { TOOL_LABELS } from './toolSchemas'
import { analyseBufferingTool, generateDiagnosticReport, getPlaybackMetrics } from './tools'

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
  at: number
  /** "ai": written by Gemini from tool results. "rules": the deterministic report, no AI involved. */
  mode?: 'ai' | 'rules'
  activities?: ToolActivity[]
  toolRuns?: ToolRun[]
  grounding?: GroundingCheck
  stopReason?: StopReason
  inferenceSource?: InferenceSource
  /** Event ids the answer cites, resolved against the session when the answer arrived. */
  citations?: Citation[]
}

export interface Citation {
  id: string
  at: string | null
  description: string | null
  /** True when a tool returned this id during the turn. */
  verified: boolean
}

export interface AssistantState {
  messages: AssistantMessage[]
  /** Set while a message is being answered: the live tool activity. */
  pending: { activities: ToolActivity[]; round: number } | null
  open: boolean
  available: boolean
  modelName: string | null
}

/** Reads the app's own stores; this is the only data the tools can reach. */
export function createToolContext(player: PlayerStore = playerStore, watchlist: WatchlistStore = watchlistStore): ToolContext {
  return {
    getSession: () => player.getSnapshot().session,
    getPlayback: () => {
      const s = player.getSnapshot()
      return { scenario: s.scenario, quality: s.quality, qualityMode: s.qualityMode, liveServiceLabel: getService(s.live.serviceId).label }
    },
    getWatchlist: () =>
      watchlist
        .getSnapshot()
        .map((e) => ({ title: getTitle(e.titleId), watched: e.watched }))
        .filter((e): e is { title: MediaTitle; watched: boolean } => e.title !== undefined),
    titles: allTitles(),
    get currentYear() {
      return new Date().getFullYear()
    },
  }
}

let n = 0
const msgId = () => `m${++n}`

function resolveCitations(text: string, grounding: GroundingCheck, ctx: ToolContext): Citation[] {
  const events = new Map((ctx.getSession()?.events ?? []).map((e) => [e.id, e]))
  return [...new Set(text.match(EVENT_ID_PATTERN) ?? [])].map((id) => {
    const e = events.get(id)
    return { id, at: e ? formatClock(e.timestamp) : null, description: e ? describeEvent(e) : null, verified: grounding.evidenceEventIds.includes(id) }
  })
}

export interface AssistantStoreOptions {
  /** null when Firebase is not configured: only the rules-based report is available. */
  factory: ChatFactory | null
  modelName?: string | null
  ctx?: ToolContext
  turnOptions?: Omit<TurnOptions, 'onActivity' | 'onThinking'>
}

export function createAssistantStore({ factory, modelName = null, ctx = createToolContext(), turnOptions }: AssistantStoreOptions) {
  const conversation = factory ? new AssistantConversation(factory, ctx) : null
  let state: AssistantState = { messages: [], pending: null, open: false, available: !!conversation, modelName }
  const listeners = new Set<() => void>()
  let controller: AbortController | null = null

  const set = (patch: Partial<AssistantState>) => {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  }
  const push = (m: Omit<AssistantMessage, 'id' | 'at'>) => set({ messages: [...state.messages, { ...m, id: msgId(), at: Date.now() }] })

  return {
    getSnapshot: () => state,
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    setOpen: (open: boolean) => set({ open }),

    /** Opens the drawer and asks a question; without AI, runs the rules-based diagnosis instead. */
    ask(text: string) {
      set({ open: true })
      if (state.available) void this.send(text)
      else this.runRulesDiagnosis()
    },

    async send(text: string) {
      const question = text.trim()
      if (!question || state.pending) return
      if (!conversation) {
        push({ role: 'user', text: question })
        push({ role: 'error', text: 'The AI assistant needs Firebase to be configured (see Settings). You can still run the rules-based diagnosis.' })
        return
      }
      push({ role: 'user', text: question })
      set({ pending: { activities: [], round: 0 } })
      controller = new AbortController()
      try {
        const r = await conversation.send(question, {
          ...turnOptions,
          signal: controller.signal,
          onActivity: (activities) => set({ pending: { activities, round: state.pending?.round ?? 0 } }),
          onThinking: (round) => set({ pending: { activities: state.pending?.activities ?? [], round } }),
        })
        set({ pending: null })
        push({
          role: 'assistant',
          mode: 'ai',
          text: r.text,
          activities: r.activities,
          toolRuns: r.toolRuns,
          grounding: r.grounding,
          stopReason: r.stopReason,
          inferenceSource: r.inferenceSource,
          citations: resolveCitations(r.text, r.grounding, ctx),
        })
      } catch (err) {
        const activities = (err as { activities?: ToolActivity[] }).activities
        set({ pending: null })
        if (controller?.signal.aborted) push({ role: 'error', text: 'Stopped.', activities })
        else push({ role: 'error', text: explainError(err instanceof Error ? err.message : String(err)), activities })
      } finally {
        controller = null
      }
    },

    /** Cancels the message being answered. */
    stop() {
      controller?.abort()
    },

    /**
     * Deterministic diagnosis with no AI: runs the same tools directly and shows the report.
     * Always available, and clearly labelled as rules-based.
     */
    runRulesDiagnosis() {
      const at = Date.now()
      const calls = [
        { name: 'get_playback_metrics' as const, run: () => getPlaybackMetrics({}, ctx) },
        { name: 'analyse_buffering' as const, run: () => analyseBufferingTool({}, ctx) },
        { name: 'generate_diagnostic_report' as const, run: () => generateDiagnosticReport({}, ctx) },
      ]
      const runs: ToolRun[] = calls.map((c) => ({ name: c.name, args: {}, result: c.run() }))
      const activities: ToolActivity[] = runs.map((r, i) => ({ id: `rules-${at}-${i}`, name: r.name, label: TOOL_LABELS[r.name], status: 'done', args: {}, startedAt: at, endedAt: at }))
      const report = runs[2]!.result as { available: boolean; problemSummary?: string; mostLikelyExplanation?: string; reason?: string }
      const text = report.available ? `${report.problemSummary} ${report.mostLikelyExplanation}` : (report.reason ?? 'No playback session yet.')
      push({ role: 'user', text: 'Run the rules-based diagnosis' })
      push({ role: 'assistant', mode: 'rules', text, activities, toolRuns: runs, grounding: checkGrounding(text, runs) })
    },

    reset() {
      controller?.abort()
      conversation?.reset()
      set({ messages: [], pending: null })
    },
  }
}

export type AssistantStore = ReturnType<typeof createAssistantStore>

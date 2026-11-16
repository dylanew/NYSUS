import type { Content, FunctionCall, FunctionResponsePart, GenerateContentResult, InferenceSource, SingleRequestOptions } from 'firebase/ai'
import type { ToolContext } from '../assistant/context'
import { checkGrounding, type GroundingCheck } from '../assistant/grounding'
import { TOOL_LABELS, TOOL_NAMES, isToolName, toolArgSchemas, type ToolName } from '../assistant/toolSchemas'
import { TOOL_IMPLEMENTATIONS } from '../assistant/tools'

/**
 * Workflow B: multi-turn cloud assistant with a bounded, validated function-calling loop.
 *
 * The SDK can call functions automatically (FunctionDeclaration.functionReference), but we
 * run the loop ourselves so every call is validated, limited, timed and shown to the viewer:
 *
 *   user message → model → [function calls → validate → execute → function responses → model]* → answer
 */

/** The part of ChatSession the loop needs; lets tests inject a scripted fake. */
export interface ChatLike {
  sendMessage(request: string | FunctionResponsePart[], options?: SingleRequestOptions): Promise<GenerateContentResult>
  getHistory(): Promise<Content[]>
}

export type ChatFactory = (history?: Content[]) => ChatLike

export interface AssistantLimits {
  /** Model round trips per viewer message (the first call plus follow-ups after tool results). */
  maxModelCalls: number
  /** Tool executions per viewer message. */
  maxToolCalls: number
  /** Wall-clock budget per viewer message. */
  timeoutMs: number
}

export const DEFAULT_LIMITS: AssistantLimits = { maxModelCalls: 6, maxToolCalls: 10, timeoutMs: 60_000 }
export const MAX_MESSAGE_LENGTH = 1000

export type ActivityStatus = 'running' | 'done' | 'error' | 'rejected'

export interface ToolActivity {
  id: string
  name: string
  label: string
  status: ActivityStatus
  args: unknown
  /** Short human-readable outcome, e.g. "3 buffering events". */
  summary?: string
  error?: string
  startedAt: number
  endedAt?: number
}

export interface ToolRun {
  name: ToolName
  args: unknown
  result: object
}

export type StopReason = 'max_model_calls' | 'max_tool_calls' | 'timeout'

export interface TurnResult {
  text: string
  activities: ToolActivity[]
  toolRuns: ToolRun[]
  grounding: GroundingCheck
  modelCalls: number
  stopReason?: StopReason
  /** Reported by the SDK for the final response; the assistant is cloud-only so this should be in_cloud. */
  inferenceSource?: InferenceSource
}

export interface TurnOptions {
  onActivity?: (activities: ToolActivity[]) => void
  /** Called when the model is being asked (initially and after each round of tool results). */
  onThinking?: (round: number) => void
  limits?: Partial<AssistantLimits>
  now?: () => number
  signal?: AbortSignal
}

export class AssistantTimeoutError extends Error {
  constructor() {
    super('The assistant took too long to answer.')
    this.name = 'AssistantTimeoutError'
  }
}

let seq = 0
const activityId = () => `act_${(++seq).toString(36)}`

function summarise(name: ToolName, result: Record<string, unknown>): string {
  if (result.available === false) return 'No playback session'
  switch (name) {
    case 'search_catalogue': return `${(result.resultCount as number | undefined) ?? 0} titles found`
    case 'get_viewer_preferences': return `${result.savedTitleCount as number} saved titles`
    case 'get_playback_metrics': return `${result.bufferingRatioPct as number}% buffering, ${result.averageThroughputMbps ?? '—'} Mbps average`
    case 'analyse_buffering': return `${result.incidentCount as number} buffering event${result.incidentCount === 1 ? '' : 's'}`
    case 'compare_network_conditions': return `${(result.periods as unknown[]).length} periods compared`
    case 'generate_diagnostic_report': return `Confidence: ${result.confidence as string}`
  }
}

/**
 * Validates and runs one function call. Never throws: problems go back to the model as an
 * `error` field so it can correct itself, and show in the activity list.
 */
export function executeToolCall(call: FunctionCall, ctx: ToolContext): { activity: Omit<ToolActivity, 'id' | 'startedAt' | 'endedAt'>; response: object; run?: ToolRun } {
  if (!isToolName(call.name)) {
    const error = `Unknown tool "${call.name}". Available tools: ${TOOL_NAMES.join(', ')}.`
    return { activity: { name: call.name, label: `Rejected unknown tool ${call.name}`, status: 'rejected', args: call.args, error }, response: { error } }
  }
  const name = call.name
  const label = TOOL_LABELS[name]
  const parsed = toolArgSchemas[name].safeParse(call.args ?? {})
  if (!parsed.success) {
    const error = `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'args'}: ${i.message}`).join('; ')}`
    return { activity: { name, label, status: 'error', args: call.args, error }, response: { error } }
  }
  try {
    const impl = TOOL_IMPLEMENTATIONS[name] as (a: unknown, c: ToolContext) => object
    const result = impl(parsed.data, ctx)
    return {
      activity: { name, label, status: 'done', args: parsed.data, summary: summarise(name, result as Record<string, unknown>) },
      response: result,
      run: { name, args: parsed.data, result },
    }
  } catch (err) {
    const error = `Tool failed: ${err instanceof Error ? err.message : String(err)}`
    return { activity: { name, label, status: 'error', args: parsed.data, error }, response: { error } }
  }
}

const LIMIT_TEXT: Record<StopReason, string> = {
  max_model_calls: 'I stopped the investigation after reaching the step limit for one question.',
  max_tool_calls: 'I stopped the investigation after reaching the tool-call limit for one question.',
  timeout: 'I stopped the investigation because it took too long.',
}

/**
 * One viewer message, end to end. Keeps the chat history consistent: if a turn is cut short
 * (limit, timeout, error) the chat is rebuilt from the history before the turn, so a dangling
 * function call never reaches the next request.
 */
export class AssistantConversation {
  private chat: ChatLike
  private readonly factory: ChatFactory
  private readonly ctx: ToolContext

  constructor(factory: ChatFactory, ctx: ToolContext) {
    this.factory = factory
    this.ctx = ctx
    this.chat = factory()
  }

  reset() {
    this.chat = this.factory()
  }

  async send(message: string, options: TurnOptions = {}): Promise<TurnResult> {
    const text = message.trim()
    if (!text) throw new Error('Type a question first.')
    if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Keep messages under ${MAX_MESSAGE_LENGTH} characters.`)

    const limits = { ...DEFAULT_LIMITS, ...options.limits }
    const now = options.now ?? (() => Date.now())
    const before = await this.chat.getHistory()
    const started = now()
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => controller.abort(), limits.timeoutMs)

    const activities: ToolActivity[] = []
    const runs: ToolRun[] = []
    let modelCalls = 0
    let toolCalls = 0
    let stopReason: StopReason | undefined

    const ask = async (request: string | FunctionResponsePart[]) => {
      if (now() - started > limits.timeoutMs) throw new AssistantTimeoutError()
      options.onThinking?.(modelCalls)
      modelCalls++
      try {
        return await this.chat.sendMessage(request, { signal: controller.signal, timeout: Math.max(1000, limits.timeoutMs - (now() - started)) })
      } catch (err) {
        if (controller.signal.aborted && !options.signal?.aborted) throw new AssistantTimeoutError()
        throw err
      }
    }

    try {
      let result = await ask(text)
      for (;;) {
        const calls = result.response.functionCalls() ?? []
        if (calls.length === 0) break
        // Out of budget: stop here; the pending calls are dropped and the chat is rebuilt below.
        if (stopReason || modelCalls >= limits.maxModelCalls) {
          stopReason ??= 'max_model_calls'
          break
        }
        const parts: FunctionResponsePart[] = []
        for (const call of calls) {
          const startedAt = now()
          const a: ToolActivity = { id: activityId(), name: call.name, label: isToolName(call.name) ? TOOL_LABELS[call.name] : call.name, status: 'running', args: call.args, startedAt }
          activities.push(a)
          options.onActivity?.(activities.map((x) => ({ ...x })))
          let response: object
          if (toolCalls >= limits.maxToolCalls) {
            stopReason = 'max_tool_calls'
            Object.assign(a, { status: 'rejected', error: 'Tool-call limit reached for this question.', endedAt: now() })
            response = { error: 'Tool-call limit reached for this question. Answer with the results you already have.' }
          } else {
            toolCalls++
            const out = executeToolCall(call, this.ctx)
            Object.assign(a, out.activity, { endedAt: now() })
            response = out.response
            if (out.run) runs.push(out.run)
          }
          options.onActivity?.(activities.map((x) => ({ ...x })))
          parts.push({ type: 'functionResponse', functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response } })
        }
        result = await ask(parts)
      }

      const pending = (result.response.functionCalls() ?? []).length > 0
      let answer = pending ? '' : safeText(result)
      if (pending || !answer) {
        answer = stopReason
          ? `${LIMIT_TEXT[stopReason]} ${runs.length ? 'The tool results I did gather are shown below.' : ''}`.trim()
          : 'I could not produce an answer to that. Please try rephrasing.'
        await this.rebuild(before, text, answer)
      }

      return {
        text: answer,
        activities,
        toolRuns: runs,
        grounding: checkGrounding(answer, runs),
        modelCalls,
        stopReason,
        inferenceSource: result.response.inferenceSource,
      }
    } catch (err) {
      // Leave the conversation as it was before this message, so the viewer can retry.
      this.chat = this.factory(before)
      for (const a of activities) if (a.status === 'running') Object.assign(a, { status: 'error', error: 'Interrupted', endedAt: now() })
      throw Object.assign(err instanceof Error ? err : new Error(String(err)), { activities })
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }
  }

  /** Replaces a turn that ended mid-tool-loop with a clean user → model text exchange. */
  private async rebuild(before: Content[], userText: string, answer: string) {
    this.chat = this.factory([
      ...before,
      { role: 'user', parts: [{ type: 'text', text: userText }] },
      { role: 'model', parts: [{ type: 'text', text: answer }] },
    ])
  }
}

function safeText(result: GenerateContentResult): string {
  try {
    return result.response.text().trim()
  } catch {
    return ''
  }
}

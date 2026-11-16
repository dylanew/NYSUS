import type { Content, FunctionCall, FunctionResponsePart, GenerateContentResult } from 'firebase/ai'
import type { ChatFactory, ChatLike } from './cloudAssistant'
import type { HybridDeps } from './hybridInference'
import { extractPreferencesByKeywords } from '../recommendations/keywordExtraction'

/**
 * Scripted stand-ins for Gemini, used only by the Playwright suite (`vite --mode e2e`).
 * Production builds never include this module: the only imports are behind
 * `import.meta.env.MODE === 'e2e'`, which Vite replaces with `false`.
 *
 * Unlike the rules-based fallback, the mock assistant goes through the real function-calling
 * loop: it asks for tools, the app validates and runs them on the live session, and its final
 * answer quotes the figures and event ids the tools returned.
 */
export const isE2eMode = () => import.meta.env.MODE === 'e2e'

function result(opts: { text?: string; calls?: FunctionCall[]; source?: 'on_device' | 'in_cloud' }): GenerateContentResult {
  return {
    response: {
      text: () => opts.text ?? '',
      functionCalls: () => opts.calls,
      inferenceSource: opts.source ?? 'in_cloud',
    },
  } as unknown as GenerateContentResult
}

/** Preference extraction that reports itself as on-device, built from the keyword extractor. */
export function createMockPreferenceDeps(): HybridDeps {
  const model = (source: 'on_device' | 'in_cloud') => ({
    async generateContent(prompt: string) {
      // The prompt ends with the viewer's request; the keyword extractor gives a plausible JSON answer.
      const request = /Viewer request: """([\s\S]*)"""/.exec(prompt)?.[1] ?? prompt
      const p = extractPreferencesByKeywords(request, new Date().getFullYear())
      return result({ text: JSON.stringify(p), source })
    },
  })
  return { hybrid: model('on_device'), cloudOnly: model('in_cloud'), probe: async () => 'available' }
}

type Responses = Record<string, Record<string, unknown>>

function answerFrom(r: Responses): string {
  const m = r.get_playback_metrics ?? {}
  const report = r.generate_diagnostic_report ?? {}
  const buffering = r.analyse_buffering as { incidents?: { eventId?: string; startEventId?: string }[] } | undefined
  if (m.available === false) return 'There is no playback session to investigate yet. Press play first.'
  const ids = (buffering?.incidents ?? []).map((i) => i.startEventId ?? i.eventId).filter(Boolean).slice(0, 3)
  return [
    `Observed: ${m.bufferingEvents} buffering events over ${m.observedSeconds} s of playback${ids.length ? ` (${ids.join(', ')})` : ''}.`,
    `Calculated: buffering ratio ${m.bufferingRatioPct}%, average throughput ${m.averageThroughputMbps} Mbps.`,
    `Likely explanation: ${String(report.mostLikelyExplanation ?? 'unclear')}`,
  ].join('\n\n')
}

/** A scripted Gemini chat: metrics + buffering analysis, then the report, then an answer quoting them. */
export function createMockAssistantFactory(): ChatFactory {
  return (history?: Content[]): ChatLike => {
    let round = 0
    const responses: Responses = {}
    return {
      async sendMessage(request: string | FunctionResponsePart[]) {
        await new Promise((r) => setTimeout(r, 150)) // visible tool activity
        if (typeof request === 'string') {
          round = 0
          if (!/buffer|stall|stream|playback|diagnos|quality|slow/i.test(request)) return result({ text: 'I can investigate playback problems. Ask why your stream is buffering.' })
          return result({ calls: [{ name: 'get_playback_metrics', args: {} }, { name: 'analyse_buffering', args: {} }] })
        }
        for (const part of request) responses[part.functionResponse.name] = part.functionResponse.response as Record<string, unknown>
        round++
        if (round === 1) return result({ calls: [{ name: 'generate_diagnostic_report', args: {} }] })
        return result({ text: answerFrom(responses) })
      },
      getHistory: async () => history ?? [],
    }
  }
}

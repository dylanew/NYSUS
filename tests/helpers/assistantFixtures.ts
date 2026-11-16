import type { Content, FunctionCall, GenerateContentResult } from 'firebase/ai'
import { vi } from 'vitest'
import { allTitles, getTitle } from '../../src/services/catalogue/catalogue'
import type { ChatLike } from '../../src/services/ai/cloudAssistant'
import type { ToolContext } from '../../src/services/assistant/context'
import { PlaybackEngine } from '../../src/services/playback/engine'
import type { PlaybackSession, ScenarioId } from '../../src/types/playback'

/** Plays a title through scripted scenarios, e.g. [['stable', 30], ['poor', 60]]. Deterministic. */
export function sessionFor(steps: [ScenarioId, number][], titleId = 'interstellar'): { session: PlaybackSession; engine: PlaybackEngine } {
  const engine = new PlaybackEngine({ titleId, scenario: steps[0]![0] })
  engine.play()
  for (const [scenario, seconds] of steps) {
    engine.setScenario(scenario)
    engine.advance(seconds)
  }
  return { session: engine.snapshot().session!, engine }
}

export function contextFor(
  session: PlaybackSession | null,
  opts: { engine?: PlaybackEngine; watchlist?: { id: string; watched: boolean }[]; service?: string } = {},
): ToolContext {
  return {
    getSession: () => session,
    getPlayback: () => {
      const s = opts.engine?.snapshot()
      return { scenario: s?.scenario ?? 'stable', quality: s?.quality ?? '720p', qualityMode: s?.qualityMode ?? 'auto', liveServiceLabel: opts.service ?? 'Netflix' }
    },
    getWatchlist: () => (opts.watchlist ?? []).map((w) => ({ title: getTitle(w.id)!, watched: w.watched })),
    titles: allTitles(),
    currentYear: 2026,
  }
}

/** A model turn: either function calls or a final text answer. */
export type Step = { calls: FunctionCall[] } | { text: string }

export function result(step: Step): GenerateContentResult {
  const calls = 'calls' in step ? step.calls : undefined
  return {
    response: {
      functionCalls: () => calls,
      text: () => ('text' in step ? step.text : ''),
      inferenceSource: 'in_cloud',
    },
  } as unknown as GenerateContentResult
}

/** A scripted chat session. Records what the loop sent and which history it was rebuilt from. */
export function scriptedChat(steps: Step[]) {
  const sent: unknown[] = []
  const histories: (Content[] | undefined)[] = []
  let i = 0
  const factory = vi.fn((history?: Content[]): ChatLike => {
    histories.push(history)
    return {
      sendMessage: vi.fn(async (req: unknown) => {
        sent.push(req)
        const step = steps[Math.min(i++, steps.length - 1)]!
        return result(step)
      }),
      getHistory: vi.fn(async () => history ?? []),
    }
  })
  return { factory, sent, histories }
}

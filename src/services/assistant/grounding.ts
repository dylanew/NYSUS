/**
 * Grounding checks on the assistant's final answer. These run in code after the model has
 * replied and are shown to the viewer, so an invented event id or figure is visible rather
 * than silently trusted.
 */
export interface GroundingCheck {
  /** Event ids the tools returned during this conversation turn. */
  evidenceEventIds: string[]
  /** Event ids the answer cites that no tool returned. */
  unverifiedEventIds: string[]
  /** Figures with units (%, Mbps, kbps, ms, s) in the answer that match no tool output. */
  unverifiedFigures: string[]
  /** Whether any telemetry tool ran for this answer. */
  telemetryChecked: boolean
}

export const EVENT_ID_PATTERN = /\bs\d+-e\d+\b/g
const FIGURE_PATTERN = /(\d+(?:\.\d+)?)\s?(%|percent|mbps|kbps|ms|seconds?|secs?|s)(?![a-z])/gi

/** Collects event ids from any tool result shape: eventId, startEventId, endEventId, eventIds[]. */
export function collectEventIds(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectEventIds(v, into))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string' && /eventid$/i.test(k)) into.add(v)
      else if (k === 'eventIds' && Array.isArray(v)) v.forEach((x) => typeof x === 'string' && into.add(x))
      else collectEventIds(v, into)
    }
  }
  return into
}

/** Every number that appears in tool output, including inside strings ("6.2 Mbps"). */
export function collectNumbers(value: unknown, into: number[] = []): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) into.push(value)
  else if (typeof value === 'string') for (const m of value.matchAll(/-?\d+(?:\.\d+)?/g)) into.push(Number(m[0]))
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, into))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectNumbers(v, into))
  return into
}

function supported(x: number, unit: string, known: number[]): boolean {
  const u = unit.toLowerCase()
  // A figure is grounded if it equals a tool value, allowing for the model rounding it,
  // or for a kbps/Mbps or ms/s conversion.
  const candidates = [x]
  if (u === 'mbps') candidates.push(x * 1000)
  if (u === 'kbps') candidates.push(x / 1000)
  if (u.startsWith('s')) candidates.push(x * 1000)
  if (u === 'ms') candidates.push(x / 1000)
  return known.some((v) => candidates.some((c) => Math.abs(v - c) <= Math.max(0.5 * 10 ** -decimals(c), Math.abs(v) * 0.01, 0.051) || Math.round(v) === c))
}

const decimals = (x: number) => (String(x).split('.')[1]?.length ?? 0)

export function checkGrounding(answer: string, toolResults: { name: string; result: unknown }[]): GroundingCheck {
  const ids = new Set<string>()
  const numbers: number[] = []
  for (const t of toolResults) {
    collectEventIds(t.result, ids)
    collectNumbers(t.result, numbers)
  }
  const cited = [...new Set(answer.match(EVENT_ID_PATTERN) ?? [])]
  const figures: string[] = []
  for (const m of answer.matchAll(FIGURE_PATTERN)) {
    if (!supported(Number(m[1]), m[2]!, numbers)) figures.push(m[0].trim())
  }
  return {
    evidenceEventIds: [...ids],
    unverifiedEventIds: cited.filter((id) => !ids.has(id)),
    unverifiedFigures: [...new Set(figures)],
    telemetryChecked: toolResults.some((t) => t.name !== 'search_catalogue' && t.name !== 'get_viewer_preferences'),
  }
}

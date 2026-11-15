import type { MediaTitle } from '../../types/media'
import type { ViewerPreferences } from '../ai/schemas'
import { termSimilarity } from '../catalogue/vocabulary'

/**
 * Transparent weighted scoring. Each component scores 0..1; only components the viewer
 * expressed take part, and their weights are renormalised, so a request that only names a
 * mood is not penalised for lacking a genre. No machine learning, fully deterministic.
 */
export const WEIGHTS = {
  genre: 0.3,
  mood: 0.25,
  theme: 0.15,
  similarity: 0.3,
  // Era and length are only scored when the viewer states them, and then they matter.
  era: 0.25,
  length: 0.25,
  profile: 0.15,
} as const

/** "Short" = finishable in an evening or a weekend. */
export const SHORT_FILM_MINUTES = 110
export const SHORT_SERIES_MINUTES = 600
export const LONG_FILM_MINUTES = 140
export const LONG_SERIES_MINUTES = 1200

export interface TasteProfile {
  genres: Record<string, number>
  moods: Record<string, number>
}

export interface RankingInput {
  preferences: ViewerPreferences
  /** A catalogue title the request named ("something like Interstellar"). */
  reference?: MediaTitle
  /** Learned from the watchlist and watched titles. */
  profile?: TasteProfile
}

export interface Reason {
  kind: keyof typeof WEIGHTS
  text: string
}

export interface Recommendation {
  title: MediaTitle
  score: number
  reasons: Reason[]
  explanation: string
}

type Component = { kind: keyof typeof WEIGHTS; value: number; reason?: string }

function matchList(requested: string[], tags: string[]): { value: number; matched: string[] } {
  if (requested.length === 0) return { value: 0, matched: [] }
  let total = 0
  const matched: string[] = []
  for (const r of requested) {
    let best = 0
    let bestTag = ''
    for (const t of tags) {
      const s = termSimilarity(r, t)
      if (s > best) [best, bestTag] = [s, t]
    }
    total += best
    if (best > 0) matched.push(bestTag)
  }
  return { value: total / requested.length, matched: [...new Set(matched)] }
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  const inter = [...A].filter((x) => B.has(x)).length
  return inter / (A.size + B.size - inter || 1)
}

export function isShort(t: MediaTitle): boolean {
  return t.duration <= (t.type === 'film' ? SHORT_FILM_MINUTES : SHORT_SERIES_MINUTES)
}
export function isLong(t: MediaTitle): boolean {
  return t.duration >= (t.type === 'film' ? LONG_FILM_MINUTES : LONG_SERIES_MINUTES)
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

function components(t: MediaTitle, { preferences: p, reference, profile }: RankingInput): Component[] {
  const out: Component[] = []

  if (p.genres.length) {
    const m = matchList(p.genres, t.genres)
    out.push({ kind: 'genre', value: m.value, reason: m.matched.length ? `it's ${list(m.matched)}` : undefined })
  }
  if (p.moods.length) {
    const m = matchList(p.moods, t.moods)
    out.push({ kind: 'mood', value: m.value, reason: m.matched.length ? `the mood is ${list(m.matched)}` : undefined })
  }
  if (p.preferredThemes.length) {
    const m = matchList(p.preferredThemes, [...t.themes, ...t.genres])
    out.push({ kind: 'theme', value: m.value, reason: m.matched.length ? `it explores ${list(m.matched)}` : undefined })
  }
  if (reference) {
    const shared = [...t.genres, ...t.moods, ...t.themes].filter((x) => [...reference.genres, ...reference.moods, ...reference.themes].includes(x))
    const value = jaccard([...t.genres, ...t.moods, ...t.themes], [...reference.genres, ...reference.moods, ...reference.themes])
    out.push({ kind: 'similarity', value: Math.min(1, value * 2), reason: shared.length ? `like ${reference.title}, it shares ${list(shared.slice(0, 3))}` : undefined })
  }
  if (p.releaseAfter !== undefined || p.releaseBefore !== undefined) {
    const after = p.releaseAfter ?? -Infinity
    const before = p.releaseBefore ?? Infinity
    const distance = t.year < after ? after - t.year : t.year > before ? t.year - before : 0
    const value = Math.max(0, 1 - distance / 5)
    out.push({ kind: 'era', value, reason: distance === 0 ? `it came out in ${t.year}, within your range` : undefined })
  }
  if (p.length !== 'any') {
    const fits = p.length === 'short' ? isShort(t) : isLong(t)
    out.push({ kind: 'length', value: fits ? 1 : 0, reason: fits ? (p.length === 'short' ? `it's short enough to finish quickly` : `it's a long, immersive watch`) : undefined })
  }
  if (profile) {
    const g = t.genres.reduce((s, x) => s + (profile.genres[x] ?? 0), 0)
    const m = t.moods.reduce((s, x) => s + (profile.moods[x] ?? 0), 0)
    const value = Math.min(1, (g + m) / 4)
    const liked = [...t.genres.filter((x) => profile.genres[x]), ...t.moods.filter((x) => profile.moods[x])]
    out.push({ kind: 'profile', value, reason: liked.length ? `you've saved other ${list(liked.slice(0, 2))} titles` : undefined })
  }
  return out
}

const CONTENT_KINDS = new Set<keyof typeof WEIGHTS>(['genre', 'mood', 'theme', 'similarity', 'profile'])

export function scoreTitle(t: MediaTitle, input: RankingInput): Recommendation {
  const parts = components(t, input)
  // Era or length alone never qualifies a title: if the viewer described content, something must match it.
  const content = parts.filter((c) => CONTENT_KINDS.has(c.kind))
  if (content.length > 0 && content.every((c) => c.value === 0)) {
    return { title: t, score: 0, reasons: [], explanation: 'No match for what you described.' }
  }
  const weightSum = parts.reduce((s, c) => s + WEIGHTS[c.kind], 0)
  const score = weightSum === 0 ? 0 : parts.reduce((s, c) => s + WEIGHTS[c.kind] * c.value, 0) / weightSum
  const reasons = parts.filter((c) => c.reason && c.value > 0).map((c) => ({ kind: c.kind, text: c.reason! }))
  const explanation = reasons.length ? `Recommended because ${list(reasons.map((r) => r.text))}.` : 'A loose match for your request.'
  return { title: t, score: Math.round(score * 1000) / 1000, reasons, explanation }
}

/**
 * Hard filters (content type, excluded genres, the referenced title itself), then score and sort.
 * Ties break by title so results are stable across runs.
 */
export function rankTitles(titles: MediaTitle[], input: RankingInput, limit = 12, minScore = 0.15): Recommendation[] {
  const p = input.preferences
  const inEra = (t: MediaTitle) => (p.releaseAfter === undefined || t.year >= p.releaseAfter) && (p.releaseBefore === undefined || t.year <= p.releaseBefore)
  const hasEra = p.releaseAfter !== undefined || p.releaseBefore !== undefined
  return titles
    .filter((t) => p.contentType === 'any' || t.type === p.contentType)
    // A stated period is a hard filter when the catalogue can satisfy it; otherwise it stays a soft score.
    .filter((t, _i, all) => !hasEra || inEra(t) || all.filter(inEra).length < 3)
    .filter((t) => !p.excludeGenres.some((x) => t.genres.some((g) => termSimilarity(x, g) === 1)))
    .filter((t) => t.id !== input.reference?.id)
    .map((t) => scoreTitle(t, input))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score || a.title.title.localeCompare(b.title.title))
    .slice(0, limit)
}

/** Builds a taste profile from saved titles; watched titles count double. */
export function buildProfile(entries: { title: MediaTitle; watched: boolean }[]): TasteProfile | undefined {
  if (entries.length === 0) return undefined
  const genres: Record<string, number> = {}
  const moods: Record<string, number> = {}
  for (const { title, watched } of entries) {
    const w = watched ? 1 : 0.5
    for (const g of title.genres) genres[g] = (genres[g] ?? 0) + w
    for (const m of title.moods) moods[m] = (moods[m] ?? 0) + w
  }
  return { genres, moods }
}

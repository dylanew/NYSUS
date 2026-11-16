import { QUALITY_LADDER, getScenario } from '../../data/demoScenarios'
import type { PlaybackEvent, PlaybackSession, ScenarioId } from '../../types/playback'
import type { ViewerPreferences } from '../ai/schemas'
import { findMentionedTitle } from '../catalogue/catalogue'
import { analyseBuffering, type BufferingIncident } from '../diagnostics/buffering'
import { THRESHOLDS, healthFindings } from '../diagnostics/findings'
import { computeMetrics, formatClock } from '../playback/metrics'
import { extractPreferencesByKeywords } from '../recommendations/keywordExtraction'
import { buildProfile, rankTitles } from '../recommendations/ranking'
import type { ToolContext } from './context'
import type { ToolArgs, ToolName } from './toolSchemas'

/**
 * Deterministic implementations of the assistant's tools. Every number the assistant can
 * quote comes from here (via services/playback and services/diagnostics); the model only
 * chooses which tools to call and explains what they returned.
 */

const r = (x: number, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp
const secs = (ms: number) => r(ms / 1000, 1)

// ── Data source: simulated scenario or a live measurement ─────────────────────

export interface DataSource {
  kind: 'simulated' | 'live' | 'mixed'
  conditions: string[]
  note: string
}

function scenariosSeen(session: PlaybackSession): ScenarioId[] {
  const seen: ScenarioId[] = []
  for (const e of session.events) if (e.type === 'network_change' && e.scenario && !seen.includes(e.scenario)) seen.push(e.scenario)
  return seen
}

export function describeDataSource(ctx: ToolContext, session: PlaybackSession): DataSource {
  const seen = scenariosSeen(session)
  const live = seen.includes('live')
  const simulated = seen.some((s) => s !== 'live')
  const service = ctx.getPlayback().liveServiceLabel
  const liveNote = `Live periods are real measurements of this viewer's own connection: throughput from timed downloads via Cloudflare, latency as response time of ${service}'s public website. NYSUS cannot see ${service}'s video servers, CDN or the viewer's account, so it cannot diagnose ${service} itself.`
  const simNote = 'Simulated periods come from a scripted NYSUS network scenario, not a real stream.'
  return {
    kind: live && simulated ? 'mixed' : live ? 'live' : 'simulated',
    conditions: seen.map((s) => getScenario(s).label),
    note: [simulated ? simNote : null, live ? liveNote : null].filter(Boolean).join(' ') || simNote,
  }
}

const NO_SESSION = {
  available: false,
  reason: 'There is no playback session yet. The viewer needs to open the Player, choose a network condition and press play.',
} as const

// ── Throughput statistics over telemetry samples ──────────────────────────────

function throughputStats(samples: PlaybackEvent[]) {
  const xs = samples.map((s) => s.throughputMbps ?? 0)
  if (xs.length === 0) return { minMbps: null, maxMbps: null, variabilityPct: null }
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
  return { minMbps: r(Math.min(...xs)), maxMbps: r(Math.max(...xs)), variabilityPct: mean > 0 ? Math.round((sd / mean) * 100) : null }
}

/**
 * Times throughput fell below the video bitrate and then recovered above it. Two or more
 * means the connection keeps dipping and coming back (unstable), rather than one drop.
 */
export function throughputRecoveries(samples: PlaybackEvent[]): number {
  // Hysteresis: jitter around the bitrate is not a recovery. Coming back means clearly above
  // the bitrate and at least twice what the lowest quality needs.
  const floorKbps = 2 * QUALITY_LADDER.at(-1)!.bitrateKbps
  let below = false
  let count = 0
  for (const s of samples) {
    const kbps = (s.throughputMbps ?? 0) * 1000
    const bitrate = s.bitrateKbps ?? 0
    if (kbps < bitrate) below = true
    else if (below && kbps >= Math.max(bitrate, floorKbps)) {
      count++
      below = false
    }
  }
  return count
}

export const UNSTABLE_MIN_RECOVERIES = 2

// ── search_catalogue ──────────────────────────────────────────────────────────

export function searchCatalogue(args: ToolArgs<'search_catalogue'>, ctx: ToolContext) {
  const fromQuery = args.query ? extractPreferencesByKeywords(args.query, ctx.currentYear) : null
  const prefs: ViewerPreferences = {
    genres: [...new Set([...(fromQuery?.genres ?? []), ...(args.genres ?? [])])],
    moods: [...new Set([...(fromQuery?.moods ?? []), ...(args.moods ?? [])])],
    preferredThemes: args.themes ?? [],
    excludeGenres: args.excludeGenres ?? [],
    releaseAfter: args.releasedAfter,
    releaseBefore: args.releasedBefore,
    contentType: args.type ?? fromQuery?.contentType ?? 'any',
    length: fromQuery?.length ?? 'any',
    confidence: 1,
  }
  const reference = args.query ? findMentionedTitle(args.query, ctx.titles) : undefined
  const profile = buildProfile(ctx.getWatchlist())
  const criteria =
    prefs.genres.length + prefs.moods.length + prefs.preferredThemes.length > 0 || reference || prefs.releaseAfter || prefs.releaseBefore || prefs.length !== 'any'
  if (!criteria) {
    return { results: [], note: 'No search criteria recognised. Pass genres, moods or themes, or a query naming a catalogue title.' }
  }
  const results = rankTitles(ctx.titles, { preferences: prefs, reference, profile }, args.maxResults ?? 5)
  return {
    criteriaUsed: {
      genres: prefs.genres,
      moods: prefs.moods,
      themes: prefs.preferredThemes,
      excludeGenres: prefs.excludeGenres,
      releasedAfter: prefs.releaseAfter ?? null,
      releasedBefore: prefs.releaseBefore ?? null,
      type: prefs.contentType,
      similarTo: reference?.title ?? null,
      personalisedWithWatchlist: !!profile,
    },
    resultCount: results.length,
    results: results.map((rec) => ({
      id: rec.title.id,
      title: rec.title.title,
      type: rec.title.type,
      year: rec.title.year,
      genres: rec.title.genres,
      moods: rec.title.moods,
      description: rec.title.description,
      demoScore: Math.round(rec.score * 100),
      matchedCriteria: rec.reasons.map((x) => x.text),
      explanation: rec.explanation,
    })),
    note: results.length ? 'demoScore is the app\'s 0-100 match score, not a critic rating.' : 'Nothing in the catalogue matched these criteria.',
  }
}

// ── get_viewer_preferences ────────────────────────────────────────────────────

const top = (weights: Record<string, number>, n: number) =>
  Object.entries(weights)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)

export function getViewerPreferences(_args: ToolArgs<'get_viewer_preferences'>, ctx: ToolContext) {
  const saved = ctx.getWatchlist()
  const profile = buildProfile(saved)
  const decades: Record<string, number> = {}
  for (const { title } of saved) decades[`${Math.floor(title.year / 10) * 10}s`] = (decades[`${Math.floor(title.year / 10) * 10}s`] ?? 0) + 1
  const session = ctx.getSession()
  const playing = session ? ctx.titles.find((t) => t.id === session.titleId) : undefined
  const interests = ctx.getInterests?.()
  return {
    savedTitleCount: saved.length,
    favouriteGenres: profile ? top(profile.genres, 5).map(([genre, weight]) => ({ genre, weight })) : [],
    preferredMoods: profile ? top(profile.moods, 5).map(([mood, weight]) => ({ mood, weight })) : [],
    preferredReleasePeriods: top(decades, 3).map(([period, titles]) => ({ period, titles })),
    watchedTitles: saved.filter((s) => s.watched).map(({ title }) => ({ id: title.id, title: title.title, year: title.year })),
    watchlist: saved.filter((s) => !s.watched).map(({ title }) => ({ id: title.id, title: title.title, year: title.year })),
    currentlyInPlayer: playing ? { id: playing.id, title: playing.title } : null,
    recentlyAskedFor: interests && interests.genres.length + interests.moods.length + interests.themes.length > 0 ? interests : null,
    note: saved.length
      ? 'Inferred from titles the viewer saved; watched titles count double. recentlyAskedFor lists what recent discovery requests were about.'
      : interests && interests.genres.length + interests.moods.length + interests.themes.length > 0
        ? 'No saved titles yet; recentlyAskedFor lists what recent discovery requests were about.'
        : 'The viewer has not saved or watched any titles yet, so there are no recorded preferences.',
  }
}

// ── get_playback_metrics ──────────────────────────────────────────────────────

export function getPlaybackMetrics(args: ToolArgs<'get_playback_metrics'>, ctx: ToolContext) {
  const session = ctx.getSession()
  if (!session) return NO_SESSION
  const window = args.lastSeconds ? { from: Math.max(0, session.elapsedMs - args.lastSeconds * 1000), to: session.elapsedMs } : undefined
  const m = computeMetrics(session, window)
  const samples = session.events.filter((e) => e.type === 'telemetry_sample' && (!window || (e.timestamp >= window.from && e.timestamp <= window.to)))
  const playback = ctx.getPlayback()
  const title = ctx.titles.find((t) => t.id === session.titleId)
  return {
    available: true,
    sessionId: session.id,
    title: title?.title ?? session.titleId,
    dataSource: describeDataSource(ctx, session),
    period: window ? { from: formatClock(window.from), to: formatClock(window.to) } : { from: '0:00', to: formatClock(session.elapsedMs) },
    status: m.status,
    currentQuality: playback.quality,
    qualityMode: playback.qualityMode,
    recordedSeconds: secs(window ? window.to - window.from : session.elapsedMs),
    observedSeconds: secs(m.observedMs),
    playingSeconds: secs(m.playingMs),
    bufferingSeconds: secs(m.bufferingMs),
    bufferingRatioPct: m.bufferingRatioPct,
    bufferingEvents: m.bufferingEvents,
    bufferingPerMinute: m.bufferingPerMinute,
    averageThroughputMbps: m.averageThroughputMbps,
    throughput: throughputStats(samples),
    averageBitrateKbps: m.averageBitrateKbps,
    averageLatencyMs: m.averageLatencyMs,
    playbackErrors: session.events
      .filter((e) => e.type === 'playback_error' && (!window || (e.timestamp >= window.from && e.timestamp <= window.to)))
      .map((e) => ({ eventId: e.id, at: formatClock(e.timestamp), details: e.details ?? null })),
    qualityChanges: m.qualityChanges.map((q) => ({ eventId: q.eventId, at: formatClock(q.timestamp), from: q.from ?? null, to: q.to ?? null })),
    telemetrySamples: m.samples,
    definitions: 'bufferingRatioPct = buffering time / (playing + buffering time) x 100. Paused time is excluded. Averages are over telemetry samples taken every 2 s.',
  }
}

// ── analyse_buffering ─────────────────────────────────────────────────────────

function patterns(incidents: BufferingIncident[]): string[] {
  const out: string[] = []
  if (incidents.length === 0) return out
  const low = incidents.filter((i) => i.contributingFactors.some((f) => /below the video bitrate|offline/.test(f)))
  out.push(`${low.length} of ${incidents.length} stalls began while throughput was below the video bitrate or the connection was offline.`)
  const raised = incidents.filter((i) => i.contributingFactors.some((f) => /Quality had been raised/.test(f)))
  if (raised.length) out.push(`${raised.length} stall${raised.length === 1 ? '' : 's'} followed a quality increase within 10 s.`)
  if (incidents.length >= 3) {
    const gaps = incidents.slice(1).map((x, i) => (x.startMs - incidents[i]!.startMs) / 1000)
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
    if (gaps.every((g) => Math.abs(g - mean) <= mean * 0.25)) out.push(`Stalls recur at a regular interval of about ${Math.round(mean)} s.`)
  }
  const highLatency = incidents.filter((i) => (i.latencyAtStartMs ?? 0) >= 150)
  if (highLatency.length) out.push(`${highLatency.length} stall${highLatency.length === 1 ? '' : 's'} began with latency of 150 ms or more.`)
  return out
}

export function analyseBufferingTool(args: ToolArgs<'analyse_buffering'>, ctx: ToolContext) {
  const session = ctx.getSession()
  if (!session) return NO_SESSION
  const all = analyseBuffering(session)
  const kept = all.slice(-(args.maxIncidents ?? 10))
  const byId = new Map(session.events.map((e) => [e.id, e]))
  return {
    available: true,
    sessionId: session.id,
    dataSource: describeDataSource(ctx, session),
    incidentCount: all.length,
    incidentsShown: kept.length,
    totalBufferingSeconds: secs(all.reduce((s, i) => s + (i.durationMs ?? session.elapsedMs - i.startMs), 0)),
    incidents: kept.map((i) => ({
      startEventId: i.startEventId,
      endEventId: i.endEventId,
      at: formatClock(i.startMs),
      durationSeconds: i.durationMs === null ? null : secs(i.durationMs),
      ongoing: i.endEventId === null,
      quality: i.quality ?? null,
      bitrateMbps: i.bitrateKbps === undefined ? null : r(i.bitrateKbps / 1000),
      throughputAtStartMbps: i.throughputAtStartMbps ?? null,
      throughputPrevious10sMbps: i.throughputBeforeMbps,
      latencyAtStartMs: i.latencyAtStartMs ?? null,
      relatedEvents: i.relatedEventIds.map((id) => {
        const e = byId.get(id)!
        return { eventId: id, at: formatClock(e.timestamp), type: e.type, details: e.details ?? null }
      }),
      contributingFactors: i.contributingFactors,
    })),
    patterns: patterns(all),
    caution: 'Contributing factors are observed coincidences in the telemetry. They suggest, but do not prove, a cause.',
  }
}

// ── compare_network_conditions ────────────────────────────────────────────────

interface Period {
  label: string
  from: number
  to: number
  scenario?: ScenarioId
}

function periods(session: PlaybackSession, splitBy: 'network_change' | 'halves' | 'window', windowSeconds: number): Period[] {
  const end = session.elapsedMs
  if (splitBy === 'network_change') {
    const changes = session.events.filter((e) => e.type === 'network_change' && e.scenario)
    const out: Period[] = []
    for (const c of changes) {
      if (out.at(-1)?.scenario === c.scenario) continue
      const last = out.at(-1)
      if (last) last.to = c.timestamp
      out.push({ label: getScenario(c.scenario!).label, from: c.timestamp, to: end, scenario: c.scenario })
    }
    const kept = out.filter((p) => p.to > p.from)
    if (kept.length >= 2) return kept
    return periods(session, 'halves', windowSeconds)
  }
  if (splitBy === 'halves') {
    const mid = Math.round(end / 2000) * 1000
    return [
      { label: 'First half', from: 0, to: mid },
      { label: 'Second half', from: mid, to: end },
    ]
  }
  const step = windowSeconds * 1000
  const count = Math.min(12, Math.ceil(end / step))
  const start = Math.max(0, end - count * step)
  return Array.from({ length: count }, (_, i) => ({ label: `Window ${i + 1}`, from: start + i * step, to: Math.min(end, start + (i + 1) * step) }))
}

export function compareNetworkConditions(args: ToolArgs<'compare_network_conditions'>, ctx: ToolContext) {
  const session = ctx.getSession()
  if (!session) return NO_SESSION
  if (session.elapsedMs < 10_000) return { available: false as const, reason: 'Less than 10 seconds recorded; not enough to compare periods.' }
  const ps = periods(session, args.splitBy ?? 'network_change', args.windowSeconds ?? 30)
  const rows = ps.map((p) => {
    const m = computeMetrics(session, { from: p.from, to: p.to })
    const samples = session.events.filter((e) => e.type === 'telemetry_sample' && e.timestamp >= p.from && e.timestamp <= p.to)
    return {
      label: p.label,
      from: formatClock(p.from),
      to: formatClock(p.to),
      observedSeconds: secs(m.observedMs),
      averageThroughputMbps: m.averageThroughputMbps,
      throughput: throughputStats(samples),
      averageLatencyMs: m.averageLatencyMs,
      averageBitrateKbps: m.averageBitrateKbps,
      bufferingEvents: m.bufferingEvents,
      bufferingRatioPct: m.bufferingRatioPct,
      playbackErrors: m.errorCount,
      qualityChanges: m.qualityChanges.length,
    }
  })
  const comparable = rows.filter((x) => x.observedSeconds > 0)
  const sorted = [...comparable].sort((a, b) => a.bufferingRatioPct - b.bufferingRatioPct || (b.averageThroughputMbps ?? 0) - (a.averageThroughputMbps ?? 0))
  const best = sorted[0]
  const worst = sorted.at(-1)
  return {
    available: true,
    sessionId: session.id,
    dataSource: describeDataSource(ctx, session),
    splitBy: rows[0]?.label === 'First half' ? 'halves' : (args.splitBy ?? 'network_change'),
    periods: rows,
    comparison:
      best && worst && best !== worst
        ? {
            bestPeriod: best.label,
            worstPeriod: worst.label,
            throughputDifferenceMbps: best.averageThroughputMbps !== null && worst.averageThroughputMbps !== null ? r(best.averageThroughputMbps - worst.averageThroughputMbps) : null,
            bufferingRatioDifferencePct: r(worst.bufferingRatioPct - best.bufferingRatioPct, 1),
            errorDifference: worst.playbackErrors - best.playbackErrors,
          }
        : null,
    note: 'Periods with no playing or buffering time (e.g. paused) are excluded from the comparison.',
  }
}

// ── generate_diagnostic_report ────────────────────────────────────────────────

export interface ReportEvidence {
  kind: 'observed' | 'calculated'
  statement: string
  eventIds: string[]
}

export interface DiagnosticReport {
  available: true
  sessionId: string
  title: string
  dataSource: DataSource
  focus: 'overall' | 'buffering' | 'errors' | 'quality'
  recordedAt: string
  problemSummary: string
  mostLikelyExplanation: string
  explanationIsCorrelation: boolean
  supportingEvidence: ReportEvidence[]
  confidence: 'high' | 'medium' | 'low'
  confidenceReason: string
  recommendedActions: string[]
  limitations: string[]
}

/** Highest quality whose bitrate fits within 80 % of a throughput figure. */
function sustainableQuality(mbps: number) {
  return QUALITY_LADDER.find((q) => q.bitrateKbps <= mbps * 1000 * 0.8) ?? QUALITY_LADDER.at(-1)!
}

export function generateDiagnosticReport(args: ToolArgs<'generate_diagnostic_report'>, ctx: ToolContext): DiagnosticReport | typeof NO_SESSION {
  const session = ctx.getSession()
  if (!session) return NO_SESSION
  const focus = args.focus ?? 'overall'
  const { metrics: m, incidents } = healthFindings(session)
  const source = describeDataSource(ctx, session)
  const playback = ctx.getPlayback()
  const title = ctx.titles.find((t) => t.id === session.titleId)?.title ?? session.titleId
  const samples = session.events.filter((e) => e.type === 'telemetry_sample')
  const tp = throughputStats(samples)
  const errors = session.events.filter((e) => e.type === 'playback_error')
  const lowTp = incidents.filter((i) => i.contributingFactors.some((f) => /below the video bitrate|offline/.test(f)))
  const downs = m.qualityChanges.filter((q) => q.from && q.to && QUALITY_LADDER.findIndex((x) => x.id === q.to) > QUALITY_LADDER.findIndex((x) => x.id === q.from))

  const evidence: ReportEvidence[] = []
  const actions: string[] = []
  const limitations: string[] = [source.note, 'Low throughput at the time of a stall is a correlation. It is consistent with a network cause but does not prove it.']
  let summary: string
  let explanation: string
  let correlation = true
  let confidence: DiagnosticReport['confidence']
  let confidenceReason: string

  const base = {
    available: true as const,
    sessionId: session.id,
    title,
    dataSource: source,
    focus,
    recordedAt: formatClock(session.elapsedMs),
  }

  if (m.observedMs < THRESHOLDS.minObservedMs) {
    return {
      ...base,
      problemSummary: 'Not enough playback has been recorded to assess this session.',
      mostLikelyExplanation: 'No diagnosis is possible yet.',
      explanationIsCorrelation: false,
      supportingEvidence: [{ kind: 'calculated', statement: `Only ${secs(m.observedMs)} s of playing or buffering time was recorded (at least 10 s is needed).`, eventIds: [] }],
      confidence: 'low',
      confidenceReason: 'Too little telemetry.',
      recommendedActions: ['Play for at least 10 seconds, then ask again.'],
      limitations,
    }
  }

  // Calculated headline figures, always included.
  evidence.push({
    kind: 'calculated',
    statement: `Buffering took ${secs(m.bufferingMs)} s of ${secs(m.observedMs)} s observed (${m.bufferingRatioPct}% buffering ratio, ${m.bufferingEvents} stall${m.bufferingEvents === 1 ? '' : 's'}).`,
    eventIds: [],
  })
  if (m.averageThroughputMbps !== null) {
    evidence.push({
      kind: 'calculated',
      statement: `Average throughput ${m.averageThroughputMbps} Mbps (range ${tp.minMbps}-${tp.maxMbps} Mbps, variability ${tp.variabilityPct ?? 0}%) against an average video bitrate of ${m.averageBitrateKbps} kbps.`,
      eventIds: [],
    })
  }

  const wantErrors = focus === 'overall' || focus === 'errors'
  const wantBuffering = focus === 'overall' || focus === 'buffering'
  const wantQuality = focus === 'overall' || focus === 'quality'

  if (wantErrors && errors.length > 0) {
    for (const e of errors) evidence.push({ kind: 'observed', statement: `Playback error at ${formatClock(e.timestamp)}: ${e.details ?? 'playback failed'}.`, eventIds: [e.id] })
    const restored = session.events.filter((e) => e.type === 'network_change' && e.details === 'Connection restored')
    for (const e of restored.slice(0, 2)) evidence.push({ kind: 'observed', statement: `Connection restored at ${formatClock(e.timestamp)}.`, eventIds: [e.id] })
  }
  if (wantBuffering) {
    for (const i of incidents.slice(-5)) {
      const below = i.contributingFactors.find((f) => /below the video bitrate|offline/.test(f))
      evidence.push({
        kind: 'observed',
        statement: `Stall at ${formatClock(i.startMs)}${i.durationMs !== null ? ` for ${secs(i.durationMs)} s` : ' (still buffering)'}: ${below ?? `throughput ${i.throughputAtStartMbps ?? '?'} Mbps at ${i.quality ?? '?'}.`}`,
        eventIds: [i.startEventId, ...(i.endEventId ? [i.endEventId] : [])],
      })
    }
  }
  if (wantQuality && downs.length > 0) {
    evidence.push({ kind: 'observed', statement: `Quality was lowered ${downs.length} time${downs.length === 1 ? '' : 's'} (last: ${downs.at(-1)!.from} to ${downs.at(-1)!.to} at ${formatClock(downs.at(-1)!.timestamp)}).`, eventIds: downs.slice(-4).map((d) => d.eventId) })
  }

  const recoveries = throughputRecoveries(samples)
  const unstable = recoveries >= UNSTABLE_MIN_RECOVERIES
  const lastSample = samples.at(-1)
  const stillLow = !!lastSample && (lastSample.throughputMbps ?? 0) * 1000 < (lastSample.bitrateKbps ?? 0)
  const live = source.kind !== 'simulated'

  if (wantErrors && errors.length > 0 && errors.some((e) => /unreachable|no data/i.test(e.details ?? ''))) {
    summary = `Playback stopped with ${errors.length} error${errors.length === 1 ? '' : 's'} after the connection stopped delivering data.`
    explanation = 'The connection dropped out completely: no data arrived for several seconds, the buffer ran dry and the player raised an error.'
    confidence = 'high'
    confidenceReason = 'The error event itself records that no data was received, so this is directly observed rather than inferred.'
    correlation = false
    actions.push('Check that the device is still connected (Wi-Fi or mobile data), then press play: the player recovers automatically once data flows again.')
    if (live) actions.push('If drop-outs repeat, restart the router or move closer to it.')
  } else if (wantBuffering && m.bufferingEvents > 0 && lowTp.length > 0) {
    const share = lowTp.length / incidents.length
    summary = `Playback buffered ${m.bufferingEvents} time${m.bufferingEvents === 1 ? '' : 's'}, ${m.bufferingRatioPct}% of the time watched.`
    explanation = unstable
      ? `The connection was inconsistent: throughput dipped below what the video needed and recovered ${recoveries} times, and the stalls began during those dips.`
      : stillLow
        ? 'Throughput dropped below the bitrate the video needed and stayed there, so the player could not download video as fast as it played it.'
        : 'Throughput fell below the bitrate the video quality needed, so the player could not download video as fast as it played it.'
    confidence = share === 1 && incidents.length >= 2 ? 'high' : share >= 0.5 ? 'medium' : 'low'
    confidenceReason = `${lowTp.length} of ${incidents.length} stalls began while throughput was below the video bitrate or the connection was offline.`
    const floor = Math.min(...lowTp.map((i) => i.throughputBeforeMbps ?? i.throughputAtStartMbps ?? 0).filter((x) => x > 0), m.averageThroughputMbps ?? Infinity)
    const measured = Number.isFinite(floor) ? floor : 0
    const lowest = QUALITY_LADDER.at(-1)!
    if (playback.qualityMode !== 'auto') actions.push(`Quality is fixed at ${playback.qualityMode}. Switch to Auto so the player can step down when the connection dips.`)
    if (measured * 1000 * 0.8 < lowest.bitrateKbps) {
      actions.push(`Lowering quality will not fully fix this: even ${lowest.id} needs ${lowest.bitrateKbps / 1000} Mbps, more than the ${r(measured)} Mbps measured around the stalls. The connection itself needs attention.`)
    } else {
      const fit = sustainableQuality(measured)
      actions.push(`Lower the quality to ${fit.id} (${fit.bitrateKbps / 1000} Mbps), which fits within the ${r(measured)} Mbps measured around the stalls.`)
    }
    if (unstable && live) actions.push('Dips that come and go often point to Wi-Fi interference or other devices sharing the connection. Try a wired connection or pause other downloads.')
    else if (live) actions.push('Pause other downloads or devices on the same network, or move closer to the router, then compare again.')
    else actions.push('Switch the network condition to Stable connection to compare how the same title plays without the dips.')
  } else if (wantBuffering && m.bufferingEvents > 0) {
    summary = `Playback buffered ${m.bufferingEvents} time${m.bufferingEvents === 1 ? '' : 's'} (${m.bufferingRatioPct}% of the time watched).`
    explanation = 'The stalls did not coincide with low throughput in the recorded samples, so the telemetry does not point to a clear cause.'
    confidence = 'low'
    confidenceReason = 'No recorded factor lines up with the stalls.'
    correlation = false
    actions.push('Keep playing to collect more samples, then run the diagnosis again.')
  } else if (wantQuality && downs.length >= 3) {
    summary = `No serious stalls, but quality was lowered ${downs.length} times.`
    explanation = 'The player repeatedly stepped quality down to keep up with the available throughput, which avoided buffering at the cost of picture quality.'
    confidence = 'medium'
    confidenceReason = 'Each quality change records the throughput estimate that triggered it.'
    actions.push('Nothing to fix if the picture looks acceptable. For steadier quality, use a faster or less busy connection.')
  } else {
    summary = errors.length || m.bufferingEvents ? `No ${focus} problems recorded.` : 'This session looks healthy.'
    explanation = `Playback ran for ${secs(m.observedMs)} s without ${focus === 'errors' ? 'errors' : 'stalling'}${errors.length === 0 ? ' or errors' : ''}.`
    confidence = m.observedMs >= 60_000 ? 'high' : 'medium'
    confidenceReason = m.observedMs >= 60_000 ? 'Over a minute of clean telemetry.' : 'Less than a minute recorded, so a later problem cannot be ruled out.'
    correlation = false
    actions.push('No action needed.')
  }

  if (samples.length < 10) limitations.push(`Only ${samples.length} telemetry samples were recorded, so averages are rough.`)
  if (unstable) evidence.push({ kind: 'calculated', statement: `Throughput dropped below the video bitrate and recovered ${recoveries} times (variability ${tp.variabilityPct}%).`, eventIds: [] })

  return {
    ...base,
    problemSummary: summary,
    mostLikelyExplanation: explanation,
    explanationIsCorrelation: correlation,
    supportingEvidence: evidence,
    confidence,
    confidenceReason,
    recommendedActions: actions,
    limitations,
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

type Impl<N extends ToolName> = (args: ToolArgs<N>, ctx: ToolContext) => object

export const TOOL_IMPLEMENTATIONS: { [N in ToolName]: Impl<N> } = {
  search_catalogue: searchCatalogue,
  get_viewer_preferences: getViewerPreferences,
  get_playback_metrics: getPlaybackMetrics,
  analyse_buffering: analyseBufferingTool,
  compare_network_conditions: compareNetworkConditions,
  generate_diagnostic_report: generateDiagnosticReport,
}

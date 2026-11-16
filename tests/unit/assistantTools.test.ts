import { describe, expect, it } from 'vitest'
import {
  TOOL_IMPLEMENTATIONS as T,
  analyseBufferingTool,
  compareNetworkConditions,
  getViewerPreferences,
  searchCatalogue,
  throughputRecoveries,
  type DiagnosticReport,
} from '../../src/services/assistant/tools'
import { contextFor, sessionFor } from '../helpers/assistantFixtures'
import { PlaybackEngine } from '../../src/services/playback/engine'

const report = (steps: Parameters<typeof sessionFor>[0]) => {
  const { session, engine } = sessionFor(steps)
  const ctx = contextFor(session, { engine })
  return { r: T.generate_diagnostic_report({}, ctx) as DiagnosticReport, session, ctx }
}

describe('playback tools on deterministic scenarios (spec 6.5)', () => {
  it('stable: confirms a healthy session with no buffering', () => {
    const { r, ctx } = report([['stable', 90]])
    expect(r.problemSummary).toMatch(/healthy/)
    expect(r.confidence).toBe('high')
    expect(T.get_playback_metrics({}, ctx)).toMatchObject({ available: true, bufferingEvents: 0, bufferingRatioPct: 0, playbackErrors: [] })
  })

  it('low bandwidth: links stalls to throughput below the bitrate, with event ids', () => {
    const { r, session } = report([['poor', 60]])
    expect(r.mostLikelyExplanation).toMatch(/below the bitrate/)
    expect(r.explanationIsCorrelation).toBe(true)
    const stallIds = session.events.filter((e) => e.type === 'buffer_start').map((e) => e.id)
    const cited = r.supportingEvidence.flatMap((e) => e.eventIds)
    expect(stallIds.length).toBeGreaterThan(0)
    for (const id of stallIds) expect(cited).toContain(id)
    expect(r.limitations.join(' ')).toMatch(/correlation/)
    // 0.6 Mbps (360p) is more than the dip allows, so the report must not promise a quality fix.
    expect(r.recommendedActions.join(' ')).toMatch(/will not fully fix/)
  })

  it('unstable: identifies repeated dips and recoveries as an inconsistent connection', () => {
    const { r, session } = report([['unstable', 120]])
    expect(r.mostLikelyExplanation).toMatch(/inconsistent/)
    expect(throughputRecoveries(session.events.filter((e) => e.type === 'telemetry_sample'))).toBeGreaterThanOrEqual(2)
  })

  it('playback error: reports the error event and its timestamp', () => {
    const { r, session } = report([['interruption', 70]])
    const err = session.events.find((e) => e.type === 'playback_error')!
    expect(r.problemSummary).toMatch(/error/)
    expect(r.explanationIsCorrelation).toBe(false)
    const ev = r.supportingEvidence.find((e) => e.eventIds.includes(err.id))!
    expect(ev.statement).toMatch(/Playback error at \d+:\d\d/)
  })

  it('says there is nothing to analyse without a session', () => {
    const ctx = contextFor(null)
    for (const name of ['get_playback_metrics', 'analyse_buffering', 'compare_network_conditions', 'generate_diagnostic_report'] as const) {
      expect(T[name]({}, ctx)).toMatchObject({ available: false })
    }
  })

  it('analyse_buffering returns each stall with ids, timing and observed factors', () => {
    const { session, engine } = sessionFor([['poor', 60]])
    const out = analyseBufferingTool({}, contextFor(session, { engine }))
    if (!out.available) throw new Error('expected a session')
    expect(out.incidentCount).toBe(session.events.filter((e) => e.type === 'buffer_start').length)
    const first = out.incidents[0]!
    expect(first.startEventId).toMatch(/^s1-e\d+$/)
    expect(first.at).toMatch(/^\d+:\d\d$/)
    expect(first.contributingFactors.length).toBeGreaterThan(0)
    expect(out.caution).toMatch(/do not prove/)
  })

  it('compare_network_conditions splits at network changes and names the worse period', () => {
    const { session, engine } = sessionFor([['stable', 30], ['poor', 40]])
    const out = compareNetworkConditions({}, contextFor(session, { engine }))
    if (!out.available) throw new Error('expected a session')
    expect(out.periods.map((p) => p.label)).toEqual(['Stable connection', 'Poor connection'])
    expect(out.comparison?.worstPeriod).toBe('Poor connection')
    expect(out.comparison!.throughputDifferenceMbps!).toBeGreaterThan(20)
  })

  it('compare_network_conditions falls back to halves when the condition never changed', () => {
    const { session, engine } = sessionFor([['unstable', 60]])
    const out = T.compare_network_conditions({}, contextFor(session, { engine })) as { periods: { label: string }[] }
    expect(out.periods.map((p) => p.label)).toEqual(['First half', 'Second half'])
  })

  it('get_playback_metrics can look at only the last N seconds', () => {
    const { session, engine } = sessionFor([['stable', 30], ['poor', 40]])
    const all = T.get_playback_metrics({}, contextFor(session, { engine })) as { averageThroughputMbps: number }
    const recent = T.get_playback_metrics({ lastSeconds: 20 }, contextFor(session, { engine })) as { averageThroughputMbps: number }
    expect(recent.averageThroughputMbps).toBeLessThan(all.averageThroughputMbps)
  })

  it('live data is labelled as a measurement of the viewer\'s connection, never of the service', () => {
    const engine = new PlaybackEngine({ titleId: 'dune', scenario: 'live' })
    engine.setLiveSample({ throughputMbps: 12, latencyMs: 40 })
    engine.play()
    engine.advance(20)
    const out = T.get_playback_metrics({}, contextFor(engine.snapshot().session, { engine, service: 'Netflix' })) as { dataSource: { kind: string; note: string } }
    expect(out.dataSource.kind).toBe('live')
    expect(out.dataSource.note).toMatch(/cannot diagnose Netflix itself/)
  })
})

describe('catalogue and preference tools', () => {
  it('search_catalogue returns only real titles, excludes the named reference, and explains matches', () => {
    const out = searchCatalogue({ query: 'something like Interstellar but darker and more suspenseful' }, contextFor(null))
    expect(out.results.length).toBeGreaterThan(0)
    expect(out.results.map((r) => r.id)).not.toContain('interstellar')
    expect(out.criteriaUsed?.similarTo).toBe('Interstellar')
    for (const r of out.results) expect(r.matchedCriteria.length).toBeGreaterThan(0)
  })

  it('search_catalogue honours structured filters', () => {
    const out = searchCatalogue({ genres: ['science fiction'], type: 'series', maxResults: 3 }, contextFor(null))
    expect(out.results.length).toBeLessThanOrEqual(3)
    for (const r of out.results) expect(r.type).toBe('series')
  })

  it('search_catalogue asks for criteria instead of returning arbitrary titles', () => {
    expect(searchCatalogue({ query: 'hmm' }, contextFor(null)).results).toEqual([])
  })

  it('get_viewer_preferences summarises the saved titles', () => {
    const out = getViewerPreferences({}, contextFor(null, { watchlist: [{ id: 'blade-runner', watched: true }, { id: 'arrival', watched: false }] }))
    expect(out.savedTitleCount).toBe(2)
    expect(out.favouriteGenres[0]?.genre).toBe('science fiction')
    expect(out.watchedTitles.map((t) => t.id)).toEqual(['blade-runner'])
    expect(out.watchlist.map((t) => t.id)).toEqual(['arrival'])
  })

  it('get_viewer_preferences is honest when nothing is saved', () => {
    expect(getViewerPreferences({}, contextFor(null)).note).toMatch(/not saved or watched any titles/)
  })
})

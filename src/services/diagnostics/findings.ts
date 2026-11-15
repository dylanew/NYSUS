import type { PlaybackSession } from '../../types/playback'
import { computeMetrics, formatClock, type PlaybackMetrics } from '../playback/metrics'
import { analyseBuffering, type BufferingIncident } from './buffering'

export type Severity = 'good' | 'warning' | 'critical'

export interface Finding {
  severity: Severity
  title: string
  /** Plain-language detail that keeps observation, calculation and possibility apart. */
  detail: string
  evidenceEventIds: string[]
}

/** Thresholds are deliberately simple and documented, so the dashboard and the assistant agree. */
export const THRESHOLDS = { bufferingRatioWarnPct: 2, bufferingRatioCriticalPct: 8, minObservedMs: 10_000 }

/**
 * Rule-based health findings for the Stream Health page. Deterministic; no AI involved.
 * The Phase 4 assistant will call the same functions as tools.
 */
export function healthFindings(session: PlaybackSession): { metrics: PlaybackMetrics; incidents: BufferingIncident[]; findings: Finding[] } {
  const metrics = computeMetrics(session)
  const incidents = analyseBuffering(session)
  const findings: Finding[] = []

  if (metrics.observedMs < THRESHOLDS.minObservedMs) {
    return { metrics, incidents, findings: [{ severity: 'good', title: 'Not enough playback yet', detail: 'Play for at least 10 seconds to see a health assessment.', evidenceEventIds: [] }] }
  }

  for (const e of session.events.filter((x) => x.type === 'playback_error')) {
    findings.push({ severity: 'critical', title: `Playback error at ${formatClock(e.timestamp)}`, detail: e.details ?? 'Playback stopped with an error.', evidenceEventIds: [e.id] })
  }

  if (metrics.bufferingEvents > 0) {
    const severity: Severity = metrics.bufferingRatioPct >= THRESHOLDS.bufferingRatioCriticalPct ? 'critical' : metrics.bufferingRatioPct >= THRESHOLDS.bufferingRatioWarnPct ? 'warning' : 'good'
    const lowThroughput = incidents.filter((i) => i.contributingFactors.some((f) => /below the video bitrate|offline/.test(f)))
    findings.push({
      severity,
      title: `Buffered ${metrics.bufferingEvents} time${metrics.bufferingEvents === 1 ? '' : 's'} (${metrics.bufferingRatioPct}% of watch time)`,
      detail:
        lowThroughput.length > 0
          ? `${lowThroughput.length} of ${incidents.length} stalls began while throughput was below the video bitrate or the connection was offline. That points to the network rather than the player, though it is a correlation, not proof.`
          : 'Stalls did not coincide with low throughput in the recorded samples.',
      evidenceEventIds: incidents.map((i) => i.startEventId),
    })
  } else {
    findings.push({ severity: 'good', title: 'No buffering', detail: `Playback ran for ${formatClock(metrics.observedMs)} without stalling.`, evidenceEventIds: [] })
  }

  const downs = metrics.qualityChanges.filter((q) => q.from && q.to && ['360p', '480p', '720p', '1080p', '2160p'].indexOf(q.to) < ['360p', '480p', '720p', '1080p', '2160p'].indexOf(q.from))
  if (downs.length >= 3) {
    findings.push({
      severity: 'warning',
      title: `Quality dropped ${downs.length} times`,
      detail: 'The player repeatedly lowered quality to keep up with the connection.',
      evidenceEventIds: downs.map((d) => d.eventId),
    })
  }
  return { metrics, incidents, findings }
}

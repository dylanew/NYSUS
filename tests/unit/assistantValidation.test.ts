import { describe, expect, it } from 'vitest'
import { executeToolCall } from '../../src/services/ai/cloudAssistant'
import { TOOL_DECLARATIONS, TOOL_NAMES, toolArgSchemas } from '../../src/services/assistant/toolSchemas'
import { checkGrounding } from '../../src/services/assistant/grounding'
import { contextFor, sessionFor } from '../helpers/assistantFixtures'

describe('tool declarations', () => {
  it('declares exactly the six tools from the spec, each with a validator', () => {
    expect(TOOL_DECLARATIONS.map((d) => d.name).sort()).toEqual(
      ['analyse_buffering', 'compare_network_conditions', 'generate_diagnostic_report', 'get_playback_metrics', 'get_viewer_preferences', 'search_catalogue'],
    )
    expect(TOOL_NAMES.sort()).toEqual(TOOL_DECLARATIONS.map((d) => d.name).sort())
  })

  it('declared parameters match the Zod schema keys', () => {
    for (const d of TOOL_DECLARATIONS) {
      const declared = Object.keys(d.parameters?.properties ?? {}).sort()
      // Zod 4 keeps refinements on the object schema, so .shape is always available.
      const shape = (toolArgSchemas[d.name as keyof typeof toolArgSchemas] as unknown as { shape: object }).shape
      expect(Object.keys(shape).sort()).toEqual(declared)
    }
  })
})

describe('executeToolCall', () => {
  const { session, engine } = sessionFor([['poor', 40]])
  const ctx = contextFor(session, { engine })

  it('rejects unknown tools without running anything', () => {
    const out = executeToolCall({ name: 'delete_database', args: {} }, ctx)
    expect(out.activity.status).toBe('rejected')
    expect(out.response).toMatchObject({ error: expect.stringMatching(/Unknown tool "delete_database"/) })
    expect(out.run).toBeUndefined()
  })

  it('rejects undeclared arguments', () => {
    const out = executeToolCall({ name: 'get_playback_metrics', args: { sql: 'DROP TABLE' } }, ctx)
    expect(out.activity.status).toBe('error')
    expect(out.response).toMatchObject({ error: expect.stringMatching(/Invalid arguments/) })
  })

  it('rejects out-of-range and wrongly typed arguments', () => {
    expect(executeToolCall({ name: 'search_catalogue', args: { maxResults: 500 } }, ctx).activity.status).toBe('error')
    expect(executeToolCall({ name: 'search_catalogue', args: { genres: 'thriller' } }, ctx).activity.status).toBe('error')
    expect(executeToolCall({ name: 'search_catalogue', args: { releasedAfter: 2020, releasedBefore: 2000 } }, ctx).activity.status).toBe('error')
  })

  it('runs valid calls and summarises the result for the activity indicator', () => {
    const out = executeToolCall({ name: 'analyse_buffering', args: {} }, ctx)
    expect(out.activity).toMatchObject({ status: 'done', label: 'Investigating buffering events' })
    expect(out.activity.summary).toMatch(/\d+ buffering event/)
    expect(out.run?.name).toBe('analyse_buffering')
  })

  it('treats missing args as an empty object', () => {
    expect(executeToolCall({ name: 'get_viewer_preferences', args: undefined as unknown as object }, ctx).activity.status).toBe('done')
  })
})

describe('checkGrounding', () => {
  const runs = [{ name: 'get_playback_metrics', result: { bufferingRatioPct: 8.4, averageThroughputMbps: 2.35, averageBitrateKbps: 2500, qualityChanges: [{ eventId: 's1-e9' }] } }]

  it('accepts ids and figures that came from tools, including rounding and unit conversion', () => {
    const g = checkGrounding('Buffering was 8.4% of the time. Throughput averaged 2.4 Mbps against 2.5 Mbps video (s1-e9).', runs)
    expect(g.unverifiedEventIds).toEqual([])
    expect(g.unverifiedFigures).toEqual([])
    expect(g.telemetryChecked).toBe(true)
  })

  it('flags invented event ids and figures', () => {
    const g = checkGrounding('Stall at s1-e99. Buffering was 31% and latency hit 900 ms.', runs)
    expect(g.unverifiedEventIds).toEqual(['s1-e99'])
    expect(g.unverifiedFigures).toEqual(['31%', '900 ms'])
  })

  it('notes when no telemetry tool was used', () => {
    expect(checkGrounding('Try Arrival.', [{ name: 'search_catalogue', result: {} }]).telemetryChecked).toBe(false)
  })
})

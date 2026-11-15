/**
 * Small evaluation set for Journey A. Each case pairs a request with model output
 * recorded from live runs on 15 Nov 2026 (or a hand-written expected extraction), and
 * checks that sanitising + ranking surface titles a human would accept. This evaluates
 * the deterministic half; live extraction quality is evaluated manually (docs/TESTING.md).
 */
import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../../src/data/catalogue'
import { findMentionedTitle } from '../../src/services/catalogue/catalogue'
import { sanitisePreferences } from '../../src/services/recommendations/guards'
import { rankTitles } from '../../src/services/recommendations/ranking'
import type { ViewerPreferences } from '../../src/services/ai/schemas'

interface EvalCase {
  request: string
  source: 'live on_device' | 'live in_cloud' | 'hand-written'
  extracted: ViewerPreferences
  /** At least one of these must appear in the top 3. */
  expectAnyInTop3: string[]
  /** None of these may appear in the top 5. */
  forbidInTop5?: string[]
}

const p = (x: Partial<ViewerPreferences>): ViewerPreferences => ({
  genres: [], moods: [], preferredThemes: [], excludeGenres: [], contentType: 'any', length: 'any', confidence: 0.8, ...x,
})

const CASES: EvalCase[] = [
  {
    request: 'Something like Interstellar, but darker and more suspenseful',
    source: 'live in_cloud',
    extracted: p({ genres: ['science fiction'], moods: ['dark', 'suspenseful'], preferredThemes: ['space exploration'], confidence: 0.7 }),
    expectAnyInTop3: ['annihilation', 'moon', 'gravity', 'severance', 'dark', 'ex-machina', 'blade-runner-2049'],
    forbidInTop5: ['interstellar', 'paddington-2', 'ted-lasso'],
  },
  {
    request: 'A psychological thriller with a clever plot from the last ten years',
    source: 'live on_device',
    extracted: p({ genres: ['psychological thriller'], moods: ['suspenseful'], preferredThemes: ['clever plot'], releaseAfter: 2016, releaseBefore: 2026, contentType: 'film' }),
    expectAnyInTop3: ['get-out', 'parasite', 'annihilation'],
    forbidInTop5: ['memento', 'se7en'],
  },
  {
    request: 'A short, light-hearted series I can finish this weekend',
    source: 'live on_device',
    // Gemini Nano invented 2020–2027; the guard must remove it.
    extracted: p({ moods: ['light-hearted'], contentType: 'series', length: 'short', releaseAfter: 2020, releaseBefore: 2027, confidence: 0.7 }),
    expectAnyInTop3: ['fleabag', 'detectorists', 'good-omens'],
    forbidInTop5: ['chernobyl', 'baby-reindeer', 'normal-people'],
  },
  {
    request: 'Something funny and feel-good to watch with my family',
    source: 'hand-written',
    extracted: p({ genres: ['comedy', 'family'], moods: ['funny', 'heartwarming'] }),
    expectAnyInTop3: ['paddington-2', 'ted-lasso', 'schitts-creek'],
    forbidInTop5: ['se7en', 'baby-reindeer'],
  },
  {
    request: 'A dark crime series about detectives, nothing supernatural',
    source: 'hand-written',
    extracted: p({ genres: ['crime'], moods: ['dark'], preferredThemes: ['detective'], excludeGenres: ['horror'], contentType: 'series' }),
    expectAnyInTop3: ['mindhunter', 'true-detective'],
    forbidInTop5: ['stranger-things'],
  },
  {
    request: 'More like Blade Runner',
    source: 'hand-written',
    extracted: p({ genres: ['science fiction'], moods: ['atmospheric'] }),
    expectAnyInTop3: ['blade-runner-2049'],
    forbidInTop5: ['blade-runner'],
  },
]

describe('discovery evaluation set', () => {
  it.each(CASES)('$request ($source)', ({ request, extracted, expectAnyInTop3, forbidInTop5 = [] }) => {
    const { preferences } = sanitisePreferences(request, extracted, 2026)
    const results = rankTitles(CATALOGUE, { preferences, reference: findMentionedTitle(request) })
    const ids = results.map((r) => r.title.id)
    expect(ids.slice(0, 3).some((id) => expectAnyInTop3.includes(id)), `top 3 were ${ids.slice(0, 3).join(', ')}`).toBe(true)
    for (const bad of forbidInTop5) expect(ids.slice(0, 5), `top 5 were ${ids.slice(0, 5).join(', ')}`).not.toContain(bad)
    for (const r of results) expect(r.explanation).not.toMatch(/undefined|NaN/)
  })
})

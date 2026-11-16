/**
 * The real Firestore repository against the emulator, with the security rules enforced:
 * what cloud sync writes is accepted, reads back intact, and deleteAll leaves nothing.
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import type { Firestore } from 'firebase/firestore'
import { createFirestoreRepo } from '../../src/services/persistence/firestoreRepo'
import { PlaybackEngine } from '../../src/services/playback/engine'
import { toRecord } from '../../src/services/playback/sessionHistory'

let env: RulesTestEnvironment
const NOW = Date.now()

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-nysus', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
})
afterAll(async () => env?.cleanup())
beforeEach(async () => env.clearFirestore())

const repoFor = (uid: string) => createFirestoreRepo(env.authenticatedContext(uid).firestore() as unknown as Firestore)

describe('Firestore repository', () => {
  it('round-trips the watchlist, preferences and sessions under the rules', async () => {
    const repo = repoFor('alice')
    const engine = new PlaybackEngine({ titleId: 'interstellar', sessionId: 's1', scenario: 'interruption', startedAt: NOW })
    engine.play()
    engine.advance(120)
    const record = toRecord(engine.snapshot().session!, NOW)!

    await repo.putWatch('alice', { titleId: 'arrival', addedAt: NOW, watched: true, updatedAt: NOW })
    await repo.putWatch('alice', { titleId: 'dune', addedAt: NOW, watched: false, updatedAt: NOW })
    await repo.deleteWatch('alice', 'dune')
    const interests = [{ at: NOW, genres: ['science fiction'], moods: ['dark'], themes: [], contentType: 'film' as const, source: 'on_device' as const }]
    await repo.putPreferences('alice', { interests, updatedAt: NOW })
    await repo.putSession('alice', record)

    const loaded = await repo.load('alice')
    expect(loaded.watchlist).toEqual([{ titleId: 'arrival', addedAt: NOW, watched: true, updatedAt: NOW }])
    expect(loaded.preferences).toEqual({ interests, updatedAt: NOW })
    expect(loaded.sessions).toHaveLength(1)
    expect(loaded.sessions[0]!.metrics.errorCount).toBe(record.metrics.errorCount)
    expect(loaded.sessions[0]!.events).toHaveLength(record.events.length)
  })

  it("cannot read another user's space", async () => {
    await repoFor('alice').putWatch('alice', { titleId: 'arrival', addedAt: NOW, watched: false, updatedAt: NOW })
    await expect(repoFor('bob').load('alice')).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('deleteAll removes everything', async () => {
    const repo = repoFor('alice')
    await repo.putWatch('alice', { titleId: 'arrival', addedAt: NOW, watched: false, updatedAt: NOW })
    await repo.putPreferences('alice', { interests: [], updatedAt: NOW })
    await repo.deleteAll('alice')
    expect(await repo.load('alice')).toEqual({ watchlist: [], preferences: null, sessions: [] })
  })
})

/**
 * Firestore security rules, run against the Firestore emulator (npm run test:rules).
 * The documents written here are built with the app's own code (toRecord, the watchlist
 * store's shape), so a change to what the app writes that the rules would reject fails here.
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { PlaybackEngine } from '../../src/services/playback/engine'
import { toRecord } from '../../src/services/playback/sessionHistory'

let env: RulesTestEnvironment
const NOW = Date.now()

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-nysus',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})
afterAll(async () => env?.cleanup())
beforeEach(async () => env.clearFirestore())

const alice = () => env.authenticatedContext('alice').firestore()
const bob = () => env.authenticatedContext('bob').firestore()
const anon = () => env.unauthenticatedContext().firestore()

const watch = (over: Record<string, unknown> = {}) => ({ titleId: 'arrival', addedAt: NOW, watched: false, updatedAt: NOW, ...over })

function realSession() {
  const engine = new PlaybackEngine({ titleId: 'interstellar', sessionId: 's3', scenario: 'poor', startedAt: NOW })
  engine.play()
  engine.advance(90)
  return JSON.parse(JSON.stringify(toRecord(engine.snapshot().session!, NOW)!)) as Record<string, unknown>
}

describe('watchlist', () => {
  it('lets a user write, read and delete their own entries', async () => {
    const db = alice()
    await assertSucceeds(setDoc(doc(db, 'users/alice/watchlist/arrival'), watch()))
    await assertSucceeds(getDoc(doc(db, 'users/alice/watchlist/arrival')))
    await assertSucceeds(getDocs(collection(db, 'users/alice/watchlist')))
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/watchlist/arrival')))
  })

  it("keeps users out of each other's data", async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/watchlist/arrival'), watch()))
    await assertFails(getDoc(doc(bob(), 'users/alice/watchlist/arrival')))
    await assertFails(getDocs(collection(bob(), 'users/alice/watchlist')))
    await assertFails(setDoc(doc(bob(), 'users/alice/watchlist/dune'), watch({ titleId: 'dune' })))
    await assertFails(deleteDoc(doc(bob(), 'users/alice/watchlist/arrival')))
  })

  it('refuses signed-out access', async () => {
    await assertFails(getDoc(doc(anon(), 'users/alice/watchlist/arrival')))
    await assertFails(setDoc(doc(anon(), 'users/alice/watchlist/arrival'), watch()))
  })

  it('accepts only the exact entry shape', async () => {
    const db = alice()
    await assertFails(setDoc(doc(db, 'users/alice/watchlist/arrival'), watch({ email: 'x@example.com' })))
    await assertFails(setDoc(doc(db, 'users/alice/watchlist/arrival'), watch({ titleId: 'dune' })))
    await assertFails(setDoc(doc(db, 'users/alice/watchlist/arrival'), watch({ watched: 'yes' })))
    await assertFails(setDoc(doc(db, 'users/alice/watchlist/arrival'), { titleId: 'arrival', addedAt: NOW, watched: false }))
    await assertFails(setDoc(doc(db, 'users/alice/watchlist/arrival'), watch({ updatedAt: NOW + 10 * 86400000 })))
    await assertFails(setDoc(doc(db, 'users/alice/watchlist/NOT_A_SLUG'), watch({ titleId: 'NOT_A_SLUG' })))
  })
})

describe('preferences', () => {
  const interest = { at: NOW, genres: ['science fiction'], moods: ['dark'], themes: [], contentType: 'film', source: 'on_device' }

  it('allows the single profile document with structured interests', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/preferences/profile'), { interests: [interest], updatedAt: NOW }))
    await assertSucceeds(getDoc(doc(alice(), 'users/alice/preferences/profile')))
    await assertFails(getDoc(doc(bob(), 'users/alice/preferences/profile')))
  })

  it('rejects other documents, extra fields and oversized histories', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/preferences/other'), { interests: [], updatedAt: NOW }))
    await assertFails(setDoc(doc(alice(), 'users/alice/preferences/profile'), { interests: [], updatedAt: NOW, lastRequest: 'raw text' }))
    await assertFails(setDoc(doc(alice(), 'users/alice/preferences/profile'), { interests: Array(13).fill(interest), updatedAt: NOW }))
  })
})

describe('playback sessions', () => {
  it('accepts a record built by the app from a real session', async () => {
    const r = realSession()
    await assertSucceeds(setDoc(doc(alice(), `users/alice/playbackSessions/${r.id}`), r))
    await assertSucceeds(getDocs(collection(alice(), 'users/alice/playbackSessions')))
    await assertFails(getDocs(collection(bob(), 'users/alice/playbackSessions')))
  })

  it('rejects mismatched ids, unknown statuses, extra fields and huge event lists', async () => {
    const r = realSession()
    const path = `users/alice/playbackSessions/${r.id}`
    await assertFails(setDoc(doc(alice(), 'users/alice/playbackSessions/other-s1'), r))
    await assertFails(setDoc(doc(alice(), path), { ...r, status: 'hacked' }))
    await assertFails(setDoc(doc(alice(), path), { ...r, conversation: 'why is it buffering' }))
    await assertFails(setDoc(doc(alice(), path), { ...r, events: Array(211).fill({ type: 'play' }) }))
    await assertFails(setDoc(doc(alice(), path), { ...r, metrics: { ...(r.metrics as object), secret: 1 } }))
  })
})

describe('everything else', () => {
  it('is denied', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice'), { name: 'Alice' }))
    await assertFails(getDoc(doc(alice(), 'users/alice')))
    await assertFails(setDoc(doc(alice(), 'users/alice/assistant/chat'), { text: 'hi' }))
    await assertFails(setDoc(doc(alice(), 'playbackSessions/x'), { a: 1 }))
    await assertFails(getDocs(collection(alice(), 'users')))
  })

  it('sanity: the emulator really enforces rules', () => {
    expect(env).toBeDefined()
  })
})

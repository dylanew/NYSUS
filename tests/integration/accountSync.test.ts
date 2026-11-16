import { describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createAccountStore } from '../../src/services/account/accountStore'
import { startCloudSync } from '../../src/services/persistence/cloudSync'
import { createPreferencesStore } from '../../src/services/preferences/preferencesStore'
import { createSessionHistoryStore, toRecord } from '../../src/services/playback/sessionHistory'
import { createWatchlistStore } from '../../src/services/watchlist/watchlistStore'
import { PlaybackEngine } from '../../src/services/playback/engine'
import { DEMO_PROFILE } from '../../src/data/demoProfile'
import { memoryRepo } from '../helpers/memoryRepo'
import { fakeAuth } from '../helpers/fakeAuth'

function stores() {
  let t = 1_700_000_000_000
  const now = () => ++t
  return { watchlist: createWatchlistStore(null, now), preferences: createPreferencesStore(null, now), sessions: createSessionHistoryStore(null) }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function session(id = 's1') {
  const e = new PlaybackEngine({ titleId: 'dune', sessionId: id, scenario: 'unstable', startedAt: 1_700_000_000_000 })
  e.play()
  e.advance(60)
  return toRecord(e.snapshot().session!, 1_700_000_100_000)!
}

describe('cloud sync', () => {
  it('merges the account copy with this device and writes back what the account lacked', async () => {
    const s = stores()
    s.watchlist.add('arrival') // device only
    s.sessions.save(session())
    const { repo, space } = memoryRepo({ u1: { watchlist: [{ titleId: 'moon', addedAt: 1_600_000_000_000, watched: true, updatedAt: 1_600_000_000_000 }] } })
    const statuses: string[] = []
    const sync = startCloudSync('u1', repo, s, (st) => statuses.push(st))
    await sync.ready
    await flush()
    expect(s.watchlist.getSnapshot().map((e) => e.titleId).sort()).toEqual(['arrival', 'moon'])
    expect(space('u1').watchlist.map((e) => e.titleId).sort()).toEqual(['arrival', 'moon'])
    expect(space('u1').sessions).toHaveLength(1)
    expect(statuses[0]).toBe('connecting')
    expect(statuses.at(-1)).toBe('synced')
    sync.stop()
  })

  it('writes each later change through, and reports failures without losing local data', async () => {
    const s = stores()
    const { repo, space, failWith } = memoryRepo()
    const statuses: string[] = []
    const sync = startCloudSync('u1', repo, s, (st) => statuses.push(st))
    await sync.ready
    s.watchlist.add('dune')
    s.watchlist.setWatched('dune', true)
    s.preferences.record({ genres: ['drama'], moods: [], preferredThemes: [], excludeGenres: [], contentType: 'any', length: 'any', confidence: 1 }, 'in_cloud')
    await flush()
    expect(space('u1').watchlist).toEqual([expect.objectContaining({ titleId: 'dune', watched: true })])
    expect(space('u1').preferences?.interests[0]?.genres).toEqual(['drama'])
    s.watchlist.remove('dune')
    await flush()
    expect(space('u1').watchlist).toEqual([])

    failWith(new Error('offline'))
    s.watchlist.add('moon')
    await flush()
    expect(statuses.at(-1)).toBe('error')
    expect(s.watchlist.has('moon')).toBe(true)
    sync.stop()
    s.watchlist.add('arrival')
    await flush()
    expect(repo.putWatch).not.toHaveBeenCalledWith('u1', expect.objectContaining({ titleId: 'arrival' }))
  })
})

describe('account', () => {
  it('starts as a guest with a private cloud space when anonymous sign-in is enabled', async () => {
    const s = stores()
    const { repo, space } = memoryRepo()
    const account = createAccountStore({ auth: fakeAuth().adapter, repo, stores: s, storage: null })
    await waitFor(() => expect(account.getSnapshot().storage).toBe('synced'))
    expect(account.getSnapshot()).toMatchObject({ kind: 'guest', phase: 'ready', user: { uid: 'anon1', isAnonymous: true } })
    account.loadDemoProfile()
    await flush()
    expect(s.watchlist.getSnapshot()).toHaveLength(DEMO_PROFILE.length)
    expect(space('anon1').watchlist).toHaveLength(DEMO_PROFILE.length)
    expect(s.watchlist.getSnapshot().filter((e) => e.watched).map((e) => e.titleId).sort()).toEqual(DEMO_PROFILE.filter((d) => d.watched).map((d) => d.id).sort())
  })

  it('falls back to this browser when anonymous sign-in is disabled', async () => {
    const account = createAccountStore({ auth: fakeAuth({ anonymousEnabled: false }).adapter, repo: memoryRepo().repo, stores: stores(), storage: null })
    await waitFor(() => expect(account.getSnapshot().storageNote).toMatch(/Anonymous sign-in is not enabled/))
    expect(account.getSnapshot()).toMatchObject({ kind: 'guest', storage: 'device', canSignIn: true })
  })

  it('works with no Firebase at all', () => {
    const account = createAccountStore({ auth: null, repo: null, stores: stores(), storage: null })
    expect(account.getSnapshot()).toMatchObject({ phase: 'ready', kind: 'guest', storage: 'unavailable', canSignIn: false })
  })

  it('upgrading a guest to Google keeps the same space and data', async () => {
    const s = stores()
    const { repo, space } = memoryRepo()
    const account = createAccountStore({ auth: fakeAuth().adapter, repo, stores: s, storage: null })
    await waitFor(() => expect(account.getSnapshot().storage).toBe('synced'))
    s.watchlist.add('arrival')
    await account.signInWithGoogle()
    expect(account.getSnapshot()).toMatchObject({ kind: 'google', user: { uid: 'anon1', displayName: 'Dana' } })
    await flush()
    expect(space('anon1').watchlist.map((e) => e.titleId)).toEqual(['arrival'])
  })

  it('signing in to an existing Google account merges the guest data into it', async () => {
    const s = stores()
    const { repo, space } = memoryRepo({ g1: { watchlist: [{ titleId: 'moon', addedAt: 1_600_000_000_000, watched: false, updatedAt: 1_600_000_000_000 }] } })
    const account = createAccountStore({ auth: fakeAuth({ existingGoogleUid: 'g1' }).adapter, repo, stores: s, storage: null })
    await waitFor(() => expect(account.getSnapshot().storage).toBe('synced'))
    s.watchlist.add('arrival')
    await account.signInWithGoogle()
    await waitFor(() => expect(space('g1').watchlist.map((e) => e.titleId).sort()).toEqual(['arrival', 'moon']))
    expect(s.watchlist.getSnapshot().map((e) => e.titleId).sort()).toEqual(['arrival', 'moon'])
  })

  it('signing out clears this browser (the account keeps it) and starts a fresh guest', async () => {
    const s = stores()
    const { repo, space } = memoryRepo()
    const auth = fakeAuth()
    const account = createAccountStore({ auth: auth.adapter, repo, stores: s, storage: null })
    await waitFor(() => expect(account.getSnapshot().storage).toBe('synced'))
    await account.signInWithGoogle()
    s.watchlist.add('arrival')
    await flush()
    await account.signOut()
    await waitFor(() => expect(account.getSnapshot().user?.uid).toBe('anon2'))
    expect(account.getSnapshot().kind).toBe('guest')
    expect(s.watchlist.getSnapshot()).toEqual([])
    expect(space('anon1').watchlist).toHaveLength(1)
  })

  it('deletes saved data locally and in the cloud', async () => {
    const s = stores()
    const { repo, space } = memoryRepo()
    const account = createAccountStore({ auth: fakeAuth().adapter, repo, stores: s, storage: null })
    await waitFor(() => expect(account.getSnapshot().storage).toBe('synced'))
    account.loadDemoProfile()
    s.sessions.save(session())
    await flush()
    await account.deleteMyData()
    expect(s.watchlist.getSnapshot()).toEqual([])
    expect(s.sessions.getSnapshot()).toEqual([])
    expect(space('anon1')).toEqual({ watchlist: [], preferences: null, sessions: [] })
    // Still syncing afterwards.
    s.watchlist.add('dune')
    await waitFor(() => expect(space('anon1').watchlist).toHaveLength(1))
  })

  it('shows sign-in errors in plain words', async () => {
    const auth = fakeAuth()
    auth.adapter.signInWithGoogle = async () => {
      throw Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' })
    }
    const account = createAccountStore({ auth: auth.adapter, repo: memoryRepo().repo, stores: stores(), storage: null })
    await account.signInWithGoogle()
    expect(account.getSnapshot()).toMatchObject({ error: 'Sign-in was cancelled.', busy: false })
  })
})

describe('demo profile stays with the guest', () => {
  it('linking to Google keeps what the guest added and drops the demo titles, here and in the cloud', async () => {
    const s = stores()
    const { repo, space } = memoryRepo()
    const account = createAccountStore({ auth: fakeAuth().adapter, repo, stores: s, storage: null })
    await waitFor(() => expect(account.getSnapshot().storage).toBe('synced'))
    s.watchlist.add('moon') // the guest's own
    account.loadDemoProfile()
    expect(account.getSnapshot().demoTitleIds.sort()).toEqual(DEMO_PROFILE.map((d) => d.id).sort())
    await flush()
    expect(space('anon1').watchlist).toHaveLength(DEMO_PROFILE.length + 1)

    await account.signInWithGoogle()
    await flush()
    expect(account.getSnapshot()).toMatchObject({ kind: 'google', demoTitleIds: [] })
    expect(s.watchlist.getSnapshot().map((e) => e.titleId)).toEqual(['moon'])
    expect(space('anon1').watchlist.map((e) => e.titleId)).toEqual(['moon'])
  })

  it("signing in to an existing Google account brings only the guest's own titles", async () => {
    const s = stores()
    const { repo, space } = memoryRepo()
    const account = createAccountStore({ auth: fakeAuth({ existingGoogleUid: 'g1' }).adapter, repo, stores: s, storage: null })
    await waitFor(() => expect(account.getSnapshot().storage).toBe('synced'))
    account.loadDemoProfile()
    s.watchlist.add('moon')
    await account.signInWithGoogle()
    await waitFor(() => expect(space('g1').watchlist.map((e) => e.titleId)).toEqual(['moon']))
  })

  it('a demo title the guest already had stays theirs, and a cancelled sign-in restores the demo', async () => {
    const s = stores()
    const auth = fakeAuth()
    auth.adapter.signInWithGoogle = async () => {
      throw Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' })
    }
    const account = createAccountStore({ auth: auth.adapter, repo: memoryRepo().repo, stores: s, storage: null })
    await waitFor(() => expect(account.getSnapshot().phase).toBe('ready'))
    s.watchlist.add('arrival') // also in the demo profile, but added by the viewer first
    account.loadDemoProfile()
    expect(account.getSnapshot().demoTitleIds).not.toContain('arrival')
    await account.signInWithGoogle()
    expect(s.watchlist.getSnapshot()).toHaveLength(DEMO_PROFILE.length)
    expect(account.getSnapshot().demoTitleIds).toHaveLength(DEMO_PROFILE.length - 1)
    expect(s.watchlist.getSnapshot().filter((e) => e.watched).map((e) => e.titleId).sort()).toEqual(['blade-runner-2049', 'dark'])

    account.clearDemoProfile()
    expect(s.watchlist.getSnapshot().map((e) => e.titleId)).toEqual(['arrival'])
  })

  it('remembers which titles are demo across reloads, and forgets one the viewer removes', async () => {
    const storage = (() => {
      const d: Record<string, string> = {}
      return { getItem: (k: string) => d[k] ?? null, setItem: (k: string, v: string) => void (d[k] = v) }
    })()
    const s = stores()
    const a1 = createAccountStore({ auth: null, repo: null, stores: s, storage })
    a1.loadDemoProfile()
    s.watchlist.remove('dark')
    const a2 = createAccountStore({ auth: null, repo: null, stores: stores(), storage })
    expect(a2.getSnapshot().demoTitleIds.sort()).toEqual(DEMO_PROFILE.map((d) => d.id).filter((id) => id !== 'dark').sort())
  })
})

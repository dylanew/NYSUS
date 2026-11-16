import { vi } from 'vitest'
import type { RemoteData, RemoteRepo } from '../../src/services/persistence/remoteRepo'

/** In-memory stand-in for Firestore, one space per uid. */
export function memoryRepo(initial: Record<string, Partial<RemoteData>> = {}) {
  const data: Record<string, RemoteData> = {}
  const space = (uid: string) => (data[uid] ??= { watchlist: [], preferences: null, sessions: [], ...initial[uid] })
  let fail: Error | null = null
  const guard = async () => {
    if (fail) throw fail
  }
  const repo: RemoteRepo = {
    load: vi.fn(async (uid: string) => {
      await guard()
      const s = space(uid)
      return { watchlist: [...s.watchlist], preferences: s.preferences, sessions: [...s.sessions] }
    }),
    putWatch: vi.fn(async (uid, e) => {
      await guard()
      const s = space(uid)
      s.watchlist = [...s.watchlist.filter((x) => x.titleId !== e.titleId), e]
    }),
    deleteWatch: vi.fn(async (uid, id) => {
      await guard()
      space(uid).watchlist = space(uid).watchlist.filter((x) => x.titleId !== id)
    }),
    putPreferences: vi.fn(async (uid, p) => {
      await guard()
      space(uid).preferences = p
    }),
    putSession: vi.fn(async (uid, r) => {
      await guard()
      const s = space(uid)
      s.sessions = [...s.sessions.filter((x) => x.id !== r.id), r]
    }),
    deleteAll: vi.fn(async (uid) => {
      await guard()
      data[uid] = { watchlist: [], preferences: null, sessions: [] }
    }),
  }
  return { repo, space, failWith: (e: Error | null) => (fail = e) }
}

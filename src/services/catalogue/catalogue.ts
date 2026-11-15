import { CATALOGUE } from '../../data/catalogue'
import type { MediaTitle } from '../../types/media'

const byId = new Map(CATALOGUE.map((t) => [t.id, t]))

export function getTitle(id: string): MediaTitle | undefined {
  return byId.get(id)
}

export function allTitles(): MediaTitle[] {
  return CATALOGUE
}

const simplify = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Finds a catalogue title the request names, e.g. "something like Interstellar".
 * Deterministic string matching; the longest title wins so "Blade Runner 2049" beats "Blade Runner".
 */
export function findMentionedTitle(request: string, titles: MediaTitle[] = CATALOGUE): MediaTitle | undefined {
  const text = ` ${simplify(request)} `
  return [...titles]
    .sort((a, b) => b.title.length - a.title.length)
    .find((t) => {
      const name = simplify(t.title.replace(/^the /i, ''))
      return name.length >= 3 && text.includes(` ${name} `)
    })
}

export function formatDuration(t: MediaTitle): string {
  const hours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`)
  if (t.type === 'film') return hours(t.duration)
  const s = t.seasons === 1 ? '1 season' : `${t.seasons ?? '?'} seasons`
  return `${s} · ${t.episodes ?? '?'} episodes · about ${Math.round(t.duration / 60)} h`
}

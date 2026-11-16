import { useStore } from '../../hooks/useStore'
import type { TasteProfile } from '../../services/recommendations/ranking'
import { preferencesStore, topInterests, type PreferencesStore } from '../../services/preferences/preferencesStore'

const top = (weights: Record<string, number>, n = 5) =>
  Object.entries(weights)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k)

function Chips({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="rounded-full border border-ink-700 px-2.5 py-0.5 text-xs text-ink-100 capitalize">
            {v}
          </span>
        ))}
      </dd>
    </div>
  )
}

/** Journey D: what NYSUS has learnt about the viewer, and from where. */
export function TasteSummary({ profile, store = preferencesStore }: { profile: TasteProfile | undefined; store?: PreferencesStore }) {
  const prefs = useStore(store)
  const askedGenres = topInterests(prefs, 'genres')
  const askedMoods = topInterests(prefs, 'moods')
  const askedThemes = topInterests(prefs, 'themes')
  if (!profile && prefs.interests.length === 0) return null
  return (
    <section aria-labelledby="taste-heading" className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
      <h2 id="taste-heading" className="font-medium">Your taste</h2>
      <p className="mt-1 text-sm text-ink-500">What NYSUS uses to personalise recommendations. The assistant can read this too.</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {profile && <Chips label="From your watchlist: genres" values={top(profile.genres)} />}
        {profile && <Chips label="From your watchlist: moods" values={top(profile.moods)} />}
        <Chips label={`You've asked for (${prefs.interests.length} recent request${prefs.interests.length === 1 ? '' : 's'})`} values={[...askedGenres, ...askedMoods].slice(0, 8)} />
        <Chips label="Themes you've asked about" values={askedThemes} />
      </dl>
    </section>
  )
}

import type { ViewerPreferences } from '../../services/ai/schemas'

function Chips({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-md bg-ink-800 px-2 py-0.5 text-sm text-ink-100">
            {item}
          </span>
        ))}
      </dd>
    </div>
  )
}

export function PreferenceResult({ preferences }: { preferences: ViewerPreferences }) {
  const period =
    preferences.releaseAfter || preferences.releaseBefore
      ? `${preferences.releaseAfter ?? 'any'} – ${preferences.releaseBefore ?? 'now'}`
      : null
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Chips label="Genres" items={preferences.genres} />
      <Chips label="Moods" items={preferences.moods} />
      <Chips label="Themes" items={preferences.preferredThemes} />
      <Chips label="Avoid" items={preferences.excludeGenres} />
      {period && <Chips label="Released" items={[period]} />}
      <Chips label="Type" items={[preferences.contentType]} />
      <Chips label="Confidence" items={[`${Math.round(preferences.confidence * 100)}%`]} />
    </dl>
  )
}

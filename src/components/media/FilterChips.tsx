export function FilterChips(props: { label: string; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="mr-2 text-xs uppercase tracking-wider text-ink-500">{props.label}</legend>
      {props.options.map((o) => {
        const on = props.selected.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => props.onToggle(o)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              on ? 'border-accent-500 bg-accent-500/20 text-accent-300' : 'border-ink-800 text-ink-300 hover:border-ink-700'
            }`}
          >
            {o}
          </button>
        )
      })}
    </fieldset>
  )
}

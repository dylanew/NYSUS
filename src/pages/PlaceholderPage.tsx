export function PlaceholderPage({ title, phase }: { title: string; phase?: number }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-ink-300">
        {phase ? `Arrives in Phase ${phase} of the build.` : 'This page does not exist.'}
      </p>
    </section>
  )
}

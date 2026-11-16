/** Placeholder while a page's code loads on a cold start. */
export function PageLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-screen items-center justify-center bg-ink-950">
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-ink-800">
        <div className="popcorn-stripes h-full w-full animate-shimmer" />
      </div>
    </div>
  )
}

/** Thin bar under the header while navigating to a page that is still loading. */
export function NavigationProgress({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div role="progressbar" aria-label="Loading page" className="absolute inset-x-0 -bottom-px h-0.5 overflow-hidden">
      <div className="h-full w-1/3 animate-[progress_1s_ease-in-out_infinite] bg-accent-400" />
    </div>
  )
}

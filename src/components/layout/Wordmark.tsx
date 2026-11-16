/** Small striped popcorn bucket, the NYSUS mark. Colours come from the theme tokens. */
export function BucketMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="11" cy="10" r="3.4" className="fill-butter" />
      <circle cx="16" cy="8.2" r="3.6" className="fill-cream" />
      <circle cx="21" cy="10" r="3.4" className="fill-butter" />
      <clipPath id="nysus-bucket">
        <path d="M7 12h18l-2.4 14H9.4z" />
      </clipPath>
      <g clipPath="url(#nysus-bucket)">
        <rect x="6" y="12" width="20" height="15" className="fill-cream" />
        <rect x="6" y="12" width="4" height="15" className="fill-accent-500" />
        <rect x="14" y="12" width="4" height="15" className="fill-accent-500" />
        <rect x="22" y="12" width="4" height="15" className="fill-accent-500" />
      </g>
    </svg>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BucketMark className="size-7 shrink-0" />
      <span className="text-lg font-semibold tracking-[0.32em] text-ink-100">
        NYS<span className="text-accent-400">U</span>S
      </span>
    </span>
  )
}

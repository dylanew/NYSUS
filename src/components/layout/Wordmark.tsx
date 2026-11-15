export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`text-lg font-semibold tracking-[0.32em] text-ink-100 ${className}`}>
      NYS<span className="text-accent-400">U</span>S
    </span>
  )
}

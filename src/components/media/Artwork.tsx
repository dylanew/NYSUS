import type { MediaTitle } from '../../types/media'

/** Deterministic generated artwork, so the catalogue needs no copyrighted posters. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function Artwork({ title, className = '' }: { title: MediaTitle; className?: string }) {
  const h = hash(title.id)
  const hueA = 250 + (h % 60) - 30 // around the violet accent
  const hueB = (hueA + 40 + ((h >> 8) % 120)) % 360
  const angle = (h >> 16) % 360
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(${angle}deg, hsl(${hueA} 55% 22%), hsl(${hueB} 45% 12%) 70%, #0a0a0c)` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_55%)]" />
      <span className="absolute bottom-3 left-3 right-3 line-clamp-3 text-lg font-semibold leading-tight text-white/90">{title.title}</span>
      <span className="absolute right-3 top-3 rounded bg-black/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/70">
        {title.type}
      </span>
    </div>
  )
}

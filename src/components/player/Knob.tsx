import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

/**
 * A rotary TV knob. It is a real ARIA slider: focusable, arrow keys / Home / End / Page keys
 * step it, and screen readers hear the value text. With a pointer you can turn it (drag
 * around the centre) or, on a stepped knob, tap to click to the next position.
 */

/** The knob sweeps 270°, from 7:30 to 4:30 on a clock face, like the real thing. */
const SWEEP = 270
const START = -SWEEP / 2

export interface KnobProps {
  /** Accessible name. */
  label: string
  /** Engraved caption under the knob. */
  caption: string
  /** Number of positions (2+). */
  count: number
  index: number
  onChange: (index: number) => void
  /** What a screen reader announces, and what the value plate shows. */
  valueText: string
  /** Shorter text for the value plate, when valueText is long. */
  plate?: string
  /** Stepped knobs click between positions and draw one tick per position. */
  stepped?: boolean
  /** Jump for PageUp / PageDown. */
  pageStep?: number
}

const angleFor = (index: number, count: number) => START + (index / (count - 1)) * SWEEP

export function Knob({ label, caption, count, index, onChange, valueText, plate, stepped = true, pageStep = 1 }: KnobProps) {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const set = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i))
    if (next !== index) onChange(next)
  }

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    // Degrees clockwise from 12 o'clock.
    const deg = Math.max(START, Math.min(-START, (Math.atan2(dx, -dy) * 180) / Math.PI))
    set(Math.round(((deg - START) / SWEEP) * (count - 1)))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: pageStep, PageDown: -pageStep }
    const delta = step[e.key]
    if (delta !== undefined) set(index + delta)
    else if (e.key === 'Home') set(0)
    else if (e.key === 'End') set(count - 1)
    else if (stepped && (e.key === 'Enter' || e.key === ' ')) onChange((index + 1) % count)
    else return
    e.preventDefault()
  }

  const ticks = stepped ? count : 11
  const angle = angleFor(index, count)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative size-16 sm:size-20">
        {/* Tick marks engraved on the cabinet around the knob. */}
        <svg aria-hidden viewBox="-50 -50 100 100" className="absolute inset-0 size-full overflow-visible">
          {Array.from({ length: ticks }, (_, i) => {
            const a = ((angleFor(i, ticks) - 90) * Math.PI) / 180
            const on = stepped ? i === index : i <= Math.round((index / (count - 1)) * (ticks - 1))
            return (
              <line
                key={i}
                x1={Math.cos(a) * 44}
                y1={Math.sin(a) * 44}
                x2={Math.cos(a) * 50}
                y2={Math.sin(a) * 50}
                strokeWidth={stepped ? 3 : 2.5}
                strokeLinecap="round"
                className={on ? 'stroke-butter' : 'stroke-cream/35'}
              />
            )
          })}
        </svg>
        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={count - 1}
          aria-valuenow={index}
          aria-valuetext={valueText}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { x: e.clientX, y: e.clientY, moved: false }
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return
            d.moved = true
            fromPointer(e)
          }}
          onPointerUp={() => {
            if (drag.current && !drag.current.moved && stepped) onChange((index + 1) % count)
            drag.current = null
          }}
          onPointerCancel={() => (drag.current = null)}
          className="tv-knob absolute inset-[14%] cursor-grab touch-none rounded-full active:cursor-grabbing focus-visible:outline-offset-4"
        >
          <div className="tv-knob-cap absolute rounded-full transition-transform duration-200 ease-out" style={{ transform: `rotate(${angle}deg)` }}>
            <span aria-hidden className="absolute left-1/2 top-[8%] h-[30%] w-[9%] -translate-x-1/2 rounded-full bg-cream shadow-[0_0_4px_rgb(251_243_228/0.6)]" />
          </div>
        </div>
      </div>
      <div className="text-center leading-tight">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/80">{caption}</div>
        <div aria-hidden className="mt-0.5 max-w-24 truncate rounded bg-ink-950/70 px-1.5 py-px font-mono text-[10px] text-butter shadow-inner">{plate ?? valueText}</div>
      </div>
    </div>
  )
}

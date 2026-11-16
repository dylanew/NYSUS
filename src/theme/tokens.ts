/**
 * Theme colours for places that need literal values (SVG charts, inline gradients).
 * Mirrors the @theme block in src/index.css: change both together when re-theming.
 */
export const THEME = {
  surface: '#171110', // ink-900, the chart background
  surfaceRaised: '#1f1816', // ink-850
  grid: '#3c302b', // ink-700
  axis: '#8c7d75', // ink-500
  textMuted: '#c9bbb1', // ink-300
  text: '#f7eee2', // ink-100
  accent: '#e03c3c', // accent-500
  cream: '#fbf3e4',
  butter: '#f6c453',
  warn: '#fbbf24',
  /** Base hue (degrees) that generated artwork is centred on. */
  artworkHue: 8,
} as const

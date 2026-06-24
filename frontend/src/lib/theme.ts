// Shared Nocturne design tokens for inline use (charts, dynamic styles).
// Tailwind utility equivalents live in src/index.css @theme.

/** Primary card surface — solid Nocturne panel with hairline border. */
export const CARD =
  'bg-surface border border-white/[0.07] rounded-2xl shadow-xl shadow-black/30'

/** Nested / input surface. */
export const SURFACE_2 =
  'bg-surface-2 border border-white/10 rounded-xl'

/** Tenure & data colours (hex, for Recharts / inline styles). */
export const COLORS = {
  owned: '#3fb97f',
  mortgage: '#f2c14e',
  rented: '#f2685c',
  origin: '#5aa9ff',
  lemon: '#c6f24e',
  track: '#222733',
} as const

/** Sequential palette for multi-series charts (language / origins). */
export const CHART_PALETTE = [
  '#c6f24e', '#5aa9ff', '#3fb97f', '#f2c14e',
  '#f2685c', '#b48cff', '#4dd0c4', '#ff9b54',
  '#7ad97a', '#f08fb8',
]

/** Mono tooltip style shared by Recharts charts. */
export const TOOLTIP_STYLE = {
  fontSize: 12,
  fontFamily: "'IBM Plex Mono', monospace",
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  backgroundColor: '#161922',
  color: '#eef1f6',
  boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
  padding: '10px 12px',
} as const

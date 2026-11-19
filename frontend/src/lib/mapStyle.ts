import type * as maplibregl from 'maplibre-gl'

// Shared by MapPage and the home page's MapPreview so both shade suburbs
// identically.

/** Free dark basemap, no token. */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'

/** Dark grey: shared "no data" fill for every metric. */
export const NO_DATA = '#374151'

/** RSI band colours, in legend order (ownership → rental). Kept in sync with ShiftIndexCard. */
export const RSI_BANDS = [
  { color: '#16a34a', label: 'Strong ownership' },
  { color: '#86efac', label: 'Mild ownership' },
  { color: '#6b7280', label: 'Stable' },
  { color: '#f97316', label: 'Mild rental' },
  { color: '#ef4444', label: 'Strong rental' },
] as const

// RSI is a custom index with meaningful breakpoints, so it keeps its diverging
// scale rather than being binned into quantiles like the percentile metrics.
export const RSI_COLOR_EXPR: maplibregl.ExpressionSpecification = [
  'case',
  ['==', ['get', 'residencyShiftIndex'], null], NO_DATA,    // no data -> dark grey
  ['>=', ['get', 'residencyShiftIndex'], 3], '#16a34a',    // strong ownership -> green
  ['>=', ['get', 'residencyShiftIndex'], 1], '#86efac',    // mild ownership -> light green
  ['>=', ['get', 'residencyShiftIndex'], -1], '#6b7280',   // stable -> grey
  ['>=', ['get', 'residencyShiftIndex'], -3], '#f97316',   // mild rental -> orange
  '#ef4444',                                               // strong rental (<= -3) -> red
]

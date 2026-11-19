// Short Residency Shift trend labels for compact home-page cards.
// The full hero treatment (gradient, description) lives in ShiftIndexCard.
// Any UI showing these must also carry the "SuburbLens Custom" mark.

export interface TrendTag {
  label: string
  /** Tailwind text + background classes for the pill. */
  className: string
  /** Text colour for a "+x pts" style delta next to a rented share. */
  deltaClassName: string
}

const TAGS: Record<string, TrendTag> = {
  strong_ownership_shift: { label: 'Strong ownership shift', className: 'bg-owned/15 text-owned', deltaClassName: 'text-owned' },
  mild_ownership_shift:   { label: 'Mild ownership shift',   className: 'bg-owned/15 text-owned', deltaClassName: 'text-owned' },
  stable:                 { label: 'Stable',                 className: 'bg-surface-3 text-muted', deltaClassName: 'text-muted' },
  mild_rental_shift:      { label: 'Mild rental shift',      className: 'bg-mortgage/15 text-mortgage', deltaClassName: 'text-mortgage' },
  strong_rental_shift:    { label: 'Strong rental shift',    className: 'bg-rented/15 text-rented', deltaClassName: 'text-rented' },
}

export function trendTag(trendLabel: string | null | undefined): TrendTag {
  return TAGS[trendLabel ?? ''] ?? TAGS.stable
}

const STATE_ABBR: Record<string, string> = {
  'New South Wales': 'NSW',
  Victoria: 'VIC',
}

/**
 * Drop the ABS disambiguation suffix for compact UI:
 * "Summer Hill (Inner West - NSW)" → "Summer Hill", "Glebe (NSW)" → "Glebe".
 * Callers show the state separately and keep the full name in title/aria.
 */
export function shortSuburbName(salName: string): string {
  return salName.replace(/\s*\([^)]*\)\s*$/, '') || salName
}

/** "NSW 2134" style line; falls back gracefully when parts are missing. */
export function stateAndPostcode(stateName: string | null | undefined, postcode?: string | null): string {
  const state = stateName ? STATE_ABBR[stateName] ?? stateName : ''
  return [state, postcode ?? ''].filter(Boolean).join(' ')
}

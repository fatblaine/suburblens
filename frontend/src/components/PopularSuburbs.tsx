import { usePopularSuburbs } from '../api/suburbs'
import type { SuburbSearchResult } from '../types/api'
import { shortSuburbName } from '../lib/trend'

interface PopularSuburbsProps {
  /** Suburbs already picked in the search box — shown as chosen, not re-addable. */
  selected: SuburbSearchResult[]
  onSelect: (suburb: SuburbSearchResult) => void
}

// Shared pill shell so skeleton and real pills are pixel-identical in height —
// that identical box model is what stops the section reflowing when data lands.
const PILL_BASE =
  'flex items-center gap-2 h-10 rounded-full pl-3.5 pr-3 border text-[13px]'

// Varied widths so the loading row reads like real suburb names, not equal bars.
const SKELETON_WIDTHS = [96, 120, 84, 132, 104, 92, 116, 100]

// Five fit on one row at the hero's width; the full top list is in the
// "Most viewed" section further down.
const MAX_PILLS = 5

// Most-viewed suburbs over the last 30 days, from our own suburb_views counter
// (v_popular_suburbs). Not Census data — it is site usage, so it stays visually
// quiet: a row of pills, no card, no chart.
//
// Clicking a pill feeds the search box rather than navigating away: the home
// page is a multi-suburb picker, so a shortcut that jumped straight to one
// suburb would cut the comparison flow short.
export default function PopularSuburbs({ selected, onSelect }: PopularSuburbsProps) {
  const { data, isLoading, isError } = usePopularSuburbs(8)

  // Only collapse to nothing once we *know* there is nothing to show (errored
  // view, or empty in the first days after launch). While the request is still
  // in flight we reserve the row's height with a skeleton, so the map card and
  // everything below it never jump down when the pills arrive.
  if (isError || (!isLoading && !data?.length)) return null

  return (
    <section className="mt-4 flex items-center gap-2.5">
      {/* No visible label: the trending icon says "popular"; screen readers get the group name. */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-lemon shrink-0">
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </svg>
      {/* One row, inside the page margins, with whole pills only: the row is
          exactly one pill tall and wraps, so any pill that doesn't fit drops to
          a hidden second line instead of being cut off or scrolled. Works the
          same on phone and desktop. */}
      <div
        role="group"
        aria-label="Most viewed this month"
        className="flex-1 min-w-0 h-10 overflow-hidden flex flex-wrap items-center gap-x-2 gap-y-4"
      >
        {isLoading
          ? SKELETON_WIDTHS.slice(0, MAX_PILLS).map((w, i) => (
              <div
                key={i}
                aria-hidden="true"
                className={PILL_BASE + ' border-white/[0.07] bg-surface-3 animate-pulse'}
                style={{ width: w }}
              >
                {/* invisible glyph pins the skeleton to a real pill's height */}
                <span className="opacity-0">·</span>
              </div>
            ))
          : data!.slice(0, MAX_PILLS).map(s => {
              const isSelected = selected.some(p => p.salCode === s.salCode)
              return (
                <button
                  key={s.salCode}
                  type="button"
                  onClick={() => onSelect(s)}
                  disabled={isSelected}
                  aria-pressed={isSelected}
                  aria-label={
                    isSelected
                      ? `${s.salName}, already selected`
                      : `Add ${s.salName}, ${s.viewCount} views in the last 30 days`
                  }
                  title={
                    isSelected
                      ? `${s.salName} is already selected`
                      : `Add ${s.salName}, ${s.stateName} (${s.viewCount} views in the last 30 days)`
                  }
                  className={
                    PILL_BASE + ' shrink-0 whitespace-nowrap transition-colors ' +
                    (isSelected
                      ? 'bg-surface-2 border-lemon/40 text-muted cursor-default'
                      : 'bg-surface-3 border-white/[0.07] text-fg hover:border-lemon/40')
                  }
                >
                  {shortSuburbName(s.salName)}
                  <span aria-hidden="true" className="font-mono text-[11px] text-faint">
                    {isSelected ? '✓' : s.viewCount.toLocaleString()}
                  </span>
                </button>
              )
            })}
      </div>
    </section>
  )
}

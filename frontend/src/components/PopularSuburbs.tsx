import { usePopularSuburbs } from '../api/suburbs'
import type { SuburbSearchResult } from '../types/api'

interface PopularSuburbsProps {
  /** Suburbs already picked in the search box — shown as chosen, not re-addable. */
  selected: SuburbSearchResult[]
  onSelect: (suburb: SuburbSearchResult) => void
}

// Shared pill shell so skeleton and real pills are pixel-identical in height —
// that identical box model is what stops the section reflowing when data lands.
const PILL_BASE =
  'flex items-center gap-2.5 rounded-full pl-4 pr-3 py-2 border text-[13px]'

// Varied widths so the loading row reads like real suburb names, not equal bars.
const SKELETON_WIDTHS = [96, 120, 84, 132, 104, 92, 116, 100]

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
    <section className="mt-8">
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-lemon mb-3">
        Popular this month
      </div>
      <div className="flex flex-wrap gap-2">
        {isLoading
          ? SKELETON_WIDTHS.map((w, i) => (
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
          : data!.map(s => {
              const isSelected = selected.some(p => p.salCode === s.salCode)
              return (
                <button
                  key={s.salCode}
                  type="button"
                  onClick={() => onSelect(s)}
                  disabled={isSelected}
                  aria-pressed={isSelected}
                  title={
                    isSelected
                      ? `${s.salName} is already selected`
                      : `Add ${s.salName}, ${s.stateName} — ${s.viewCount} views in the last 30 days`
                  }
                  className={
                    PILL_BASE + ' transition-colors ' +
                    (isSelected
                      ? 'bg-surface-2 border-lemon/40 text-muted cursor-default'
                      : 'bg-surface-3 border-white/[0.07] text-fg hover:border-lemon/40')
                  }
                >
                  {s.salName}
                  <span className="font-mono text-[11px] text-dim">
                    {isSelected ? '✓' : s.viewCount}
                  </span>
                </button>
              )
            })}
      </div>
    </section>
  )
}

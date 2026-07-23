import { usePopularSuburbs } from '../api/suburbs'
import type { SuburbSearchResult } from '../types/api'

interface PopularSuburbsProps {
  /** Suburbs already picked in the search box — shown as chosen, not re-addable. */
  selected: SuburbSearchResult[]
  onSelect: (suburb: SuburbSearchResult) => void
}

// Most-viewed suburbs over the last 30 days, from our own suburb_views counter
// (v_popular_suburbs). Not Census data — it is site usage, so it stays visually
// quiet: a row of pills, no card, no chart.
//
// Clicking a pill feeds the search box rather than navigating away: the home
// page is a multi-suburb picker, so a shortcut that jumped straight to one
// suburb would cut the comparison flow short.
export default function PopularSuburbs({ selected, onSelect }: PopularSuburbsProps) {
  const { data, isLoading, isError } = usePopularSuburbs(8)

  // Empty for the first few days after launch. Render nothing rather than an
  // empty heading — an errored/absent view should be invisible, not broken.
  if (isLoading || isError || !data?.length) return null

  return (
    <section className="mt-8">
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-lemon mb-3">
        Popular this month
      </div>
      <div className="flex flex-wrap gap-2">
        {data.map(s => {
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
                'flex items-center gap-2.5 rounded-full pl-4 pr-3 py-2 border text-[13px] transition-colors ' +
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

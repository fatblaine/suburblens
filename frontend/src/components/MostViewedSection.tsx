import { Link } from 'react-router-dom'
import { usePopularSuburbs, useSuburbTenureBatch } from '../api/suburbs'
import type { SuburbSearchResult } from '../types/api'
import { trendTag, stateAndPostcode, shortSuburbName } from '../lib/trend'

interface Props {
  /** Suburbs already in the search box: their + button shows as added. */
  selected: SuburbSearchResult[]
  /** Adds a suburb to the search box at the top of the page. */
  onAdd: (suburb: SuburbSearchResult) => void
}

// Top four most-viewed suburbs (last 30 days) with their 2021 rented share.
// The card opens the profile; the + button feeds the search box instead, so
// the guide never starts a flow of its own.
export default function MostViewedSection({ selected, onAdd }: Props) {
  const { data: popular, isError } = usePopularSuburbs(8)
  const top = (popular ?? []).slice(0, 4)
  const tenure = useSuburbTenureBatch(top.map(s => s.salCode))

  if (isError || (popular && top.length === 0)) return null

  const bySal = new Map((tenure.data ?? []).map(t => [t.salCode, t]))

  function add(s: SuburbSearchResult) {
    onAdd(s)
    // Bring the search box back into view so the user sees the chip land.
    document.getElementById('home-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <section aria-labelledby="most-viewed-title" className="reveal max-w-[1240px] mx-auto px-6 sm:px-8 pt-2 pb-12">
      <div className="font-mono text-xs tracking-[0.16em] uppercase text-lemon mb-3">Most viewed</div>
      <h2 id="most-viewed-title" className="font-display font-bold text-[28px] sm:text-[38px] tracking-tight leading-tight mb-7">
        What others are looking at this month
      </h2>

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
        {!popular
          ? [0, 1, 2, 3].map(i => (
              <div key={i} aria-hidden="true" className="h-[188px] rounded-2xl bg-surface border border-white/[0.07] animate-pulse" />
            ))
          : top.map((s, i) => {
              const t = bySal.get(s.salCode)
              const now = t?.tenure.rent.y2021 ?? null
              const then = t?.tenure.rent.y2011 ?? null
              const delta = now != null && then != null ? now - then : null
              const tag = trendTag(t?.trendLabel)
              const added = selected.some(p => p.salCode === s.salCode)
              return (
                <div key={s.salCode} className="relative flex flex-col rounded-2xl bg-surface border border-white/[0.07] transition-colors hover:border-lemon/30">
                  {/* flex column + mt-auto: names may wrap, but every card's
                      numbers and bar sit on the same baseline at the bottom. */}
                  <Link to={`/suburb/${s.salCode}`} title={s.salName} className="flex-1 flex flex-col p-[22px] text-fg">
                    <span className={`font-mono text-[11px] ${i === 0 ? 'text-lemon' : 'text-faint'}`}>#{i + 1}</span>
                    <div className="mt-2 pr-12">
                      <span className="font-display font-semibold text-[19px]">{shortSuburbName(s.salName)}</span>{' '}
                      <span className="font-mono text-xs text-faint whitespace-nowrap">{stateAndPostcode(s.stateName, t?.postcode)}</span>
                    </div>
                    <div className="mt-auto pt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Homes rented, 2021</div>
                    <div className="flex items-baseline gap-2.5 mt-1">
                      <span className="font-display font-semibold text-[28px]">{now != null ? `${now.toFixed(1)}%` : '–'}</span>
                      {delta != null && (
                        <span className={`font-mono text-xs ${tag.deltaClassName}`}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(1)} pts
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-track mt-3 overflow-hidden shrink-0">
                      <div className="h-full bg-rented" style={{ width: `${now ?? 0}%` }} />
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => add(s)}
                    disabled={added}
                    aria-label={added ? `${s.salName} is already in your search` : `Add ${s.salName} to your search`}
                    className="absolute top-4 right-4 w-11 h-11 rounded-[10px] border border-white/12 bg-surface-2 flex items-center justify-center text-lemon transition-colors hover:border-lemon/50 disabled:text-muted disabled:cursor-default disabled:hover:border-white/12"
                  >
                    {added ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    )}
                  </button>
                </div>
              )
            })}
      </div>
    </section>
  )
}

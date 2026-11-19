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

interface Row {
  suburb: SuburbSearchResult
  rank: number
  name: string
  place: string
  now: number | null
  delta: number | null
  deltaClass: string
  added: boolean
}

const fmtPct = (v: number | null) => (v != null ? `${v.toFixed(1)}%` : '–')
const fmtDelta = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`

function AddButton({ row, onAdd, className = '' }: { row: Row; onAdd: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={row.added}
      aria-label={row.added ? `${row.suburb.salName} is already in your search` : `Add ${row.suburb.salName} to your search`}
      className={`w-11 h-11 shrink-0 rounded-[10px] border border-white/12 bg-surface-2 flex items-center justify-center text-lemon transition-colors hover:border-lemon/50 disabled:text-muted disabled:cursor-default disabled:hover:border-white/12 ${className}`}
    >
      {row.added ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      )}
    </button>
  )
}

// Top four most-viewed suburbs (last 30 days) with their 2021 rented share.
// Rendered from the sm breakpoint up only (HomePage): on phones the popular
// pills already cover it. The card opens the profile and the + button feeds
// the search box, so the guide never starts a flow of its own.
export default function MostViewedSection({ selected, onAdd }: Props) {
  const { data: popular, isError } = usePopularSuburbs(8)
  const top = (popular ?? []).slice(0, 4)
  const tenure = useSuburbTenureBatch(top.map(s => s.salCode))

  if (isError || (popular && top.length === 0)) return null

  const bySal = new Map((tenure.data ?? []).map(t => [t.salCode, t]))

  const rows: Row[] = top.map((s, i) => {
    const t = bySal.get(s.salCode)
    const now = t?.tenure.rent.y2021 ?? null
    const then = t?.tenure.rent.y2011 ?? null
    return {
      suburb: s,
      rank: i + 1,
      name: shortSuburbName(s.salName),
      place: stateAndPostcode(s.stateName, t?.postcode),
      now,
      delta: now != null && then != null ? now - then : null,
      deltaClass: trendTag(t?.trendLabel).deltaClassName,
      added: selected.some(p => p.salCode === s.salCode),
    }
  })

  function add(s: SuburbSearchResult) {
    onAdd(s)
    // Bring the search box back into view so the user sees the chip land.
    document.getElementById('home-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <section aria-labelledby="most-viewed-title" className="reveal max-w-[1240px] mx-auto px-4 sm:px-8 pt-2 pb-8">
      <div className="font-mono text-xs tracking-[0.16em] uppercase text-lemon mb-3 sm:mb-4">Most viewed</div>
      <h2 id="most-viewed-title" className="font-display font-bold text-[26px] sm:text-[38px] tracking-tight leading-tight mb-5 sm:mb-7">
        What others are looking at this month
      </h2>

      {!popular ? (
        <div aria-hidden="true" className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[188px] rounded-2xl bg-surface border border-white/[0.07] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]">
            {rows.map(r => (
              <div key={r.suburb.salCode} className="relative flex flex-col rounded-2xl bg-surface border border-white/[0.07] transition-colors hover:border-lemon/30">
                {/* flex column + mt-auto: names may wrap, but every card's
                    numbers and bar sit on the same baseline at the bottom. */}
                <Link to={`/suburb/${r.suburb.salCode}`} title={r.suburb.salName} className="flex-1 flex flex-col p-[22px] text-fg">
                  <span className={`font-mono text-[11px] ${r.rank === 1 ? 'text-lemon' : 'text-faint'}`}>#{r.rank}</span>
                  <div className="mt-2 pr-12">
                    <span className="font-display font-semibold text-[19px]">{r.name}</span>{' '}
                    <span className="font-mono text-xs text-faint whitespace-nowrap">{r.place}</span>
                  </div>
                  <div className="mt-auto pt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Homes rented, 2021</div>
                  <div className="flex items-baseline gap-2.5 mt-1">
                    <span className="font-display font-semibold text-[28px]">{fmtPct(r.now)}</span>
                    {r.delta != null && (
                      <span className={`font-mono text-xs ${r.deltaClass}`}>{fmtDelta(r.delta)} pts</span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-track mt-3 overflow-hidden shrink-0">
                    <div className="h-full bg-rented" style={{ width: `${r.now ?? 0}%` }} />
                  </div>
                </Link>
                <AddButton row={r} onAdd={() => add(r.suburb)} className="absolute top-4 right-4" />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

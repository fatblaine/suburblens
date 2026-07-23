import { Link } from 'react-router-dom'
import { usePopularSuburbs } from '../api/suburbs'

// Most-viewed suburbs over the last 30 days, from our own suburb_views counter
// (v_popular_suburbs). Not Census data — it is site usage, so it stays visually
// quiet: a row of pills, no card, no chart.
export default function PopularSuburbs() {
  const { data, isLoading, isError } = usePopularSuburbs(8)

  // Empty for the first few days after launch. Render nothing rather than an
  // empty heading — an errored/absent view should be invisible, not broken.
  if (isLoading || isError || !data?.length) return null

  return (
    <section className="mt-12">
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-lemon mb-3">
        Popular this month
      </div>
      <div className="flex flex-wrap gap-2">
        {data.map(s => (
          <Link
            key={s.salCode}
            to={`/suburb/${s.salCode}`}
            title={`${s.salName}, ${s.stateName} — ${s.viewCount} views in the last 30 days`}
            className="flex items-center gap-2.5 rounded-full pl-4 pr-3 py-2 bg-surface-3 border border-white/[0.07] text-[13px] text-fg transition-colors hover:border-lemon/40"
          >
            {s.salName}
            <span className="font-mono text-[11px] text-dim">{s.viewCount}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

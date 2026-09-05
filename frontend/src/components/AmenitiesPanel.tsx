import { useState } from 'react'
import { useSuburbAmenities } from '../api/suburbs'
import { CARD, COLORS } from '../lib/theme'
import type { AmenityCounts } from '../types/api'

// Local amenities — OpenStreetMap POI counts inside the suburb boundary.
// Shown next to DistancePanel: "how far to things" + "how much is right here".
//
// Raw counts are what the user reads (23 cafés is concrete); the percentile
// underneath ranks by amenities per km² so big outer suburbs aren't flattered
// by area alone. Same split as the crime/density cards.

const ROWS: { key: keyof Omit<AmenityCounts, 'total'>; label: string; color: string }[] = [
  { key: 'food', label: 'Food & drink', color: COLORS.lemon },
  { key: 'nightlife', label: 'Bars & pubs', color: COLORS.origin },
  { key: 'grocery', label: 'Groceries', color: COLORS.owned },
]

// Percentile → plain-language label. Thresholds mirror densityTier in SuburbCard.
function amenityTier(pct: number): { label: string; className: string } {
  if (pct >= 0.8) return { label: 'Amenity-rich', className: 'bg-lemon/15 text-lemon' }
  if (pct >= 0.4) return { label: 'Moderate', className: 'bg-surface-3 text-muted' }
  return { label: 'Quiet', className: 'bg-surface-3 text-faint' }
}

function CountRow({ label, count, max, color }: {
  label: string; count: number; max: number; color: string
}) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <li className="py-2 border-t border-white/[0.06] first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-fg font-sans">{label}</span>
        <span className="font-mono text-sm text-muted shrink-0 tabular-nums">{count}</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: COLORS.track }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </li>
  )
}

export default function AmenitiesPanel({
  salCode,
  collapsible = false,
  defaultOpen = false,
}: {
  salCode: string
  /** Compare page folds this away by default so the column stays scannable. */
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const { data, isPending, isError } = useSuburbAmenities(salCode)
  const [open, setOpen] = useState(defaultOpen)
  const shown = !collapsible || open

  // Out of scope → 404 → hide the panel entirely (same as DistancePanel).
  if (isError) return null

  if (isPending) {
    return (
      <div className={CARD + ' p-6'}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-28 bg-white/10 rounded" />
          <div className="h-5 w-40 bg-white/10 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="h-3 w-24 bg-white/10 rounded" />
                <div className="h-3 w-8 bg-white/10 rounded" />
              </div>
              <div className="h-1 w-full bg-white/10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { counts, benchmark } = data
  const city = data.gccsaName ?? ''
  const max = Math.max(counts.food, counts.nightlife, counts.grocery)
  // Zero is a real answer here (383 in-scope suburbs are national park, water or
  // industrial land), so say so rather than rendering three empty bars.
  const isEmpty = counts.total === 0
  const tier = benchmark && !isEmpty ? amenityTier(benchmark.percentileRank) : null

  // The tier badge stays in the header so a collapsed card still says something.
  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-lemon">Local Amenities</p>
        <h3 className="font-display text-lg font-semibold text-fg mt-1">What&rsquo;s Around</h3>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {tier && (
          <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tier.className}`}>
            {tier.label}
          </span>
        )}
        {collapsible && (
          <span
            aria-hidden="true"
            className={`text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className={CARD + ' p-6'}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          aria-expanded={open}
          className="w-full text-left"
        >
          {header}
        </button>
      ) : (
        header
      )}

      {shown && (isEmpty ? (
        <p className="mt-4 text-sm text-muted">
          No mapped shops, cafés or venues inside this suburb&rsquo;s boundary — it is
          most likely parkland, water or non-residential land.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-bold tracking-tight text-fg">
              {counts.total.toLocaleString()}
            </span>
            <span className="font-mono text-sm text-muted">places</span>
          </div>

          <ul className="mt-3">
            {ROWS.map(r => (
              <CountRow key={r.key} label={r.label} count={counts[r.key]} max={max} color={r.color} />
            ))}
          </ul>

          {benchmark && (
            <p className="mt-3 text-sm text-muted">
              More per km&sup2; than{' '}
              <span className="text-fg">{Math.round(benchmark.percentileRank * 100)}%</span> of {city} suburbs
              {data.totalPerSqkm != null && (
                <span className="text-faint"> · {data.totalPerSqkm.toFixed(1)}/km&sup2;</span>
              )}
            </p>
          )}
        </>
      ))}

      {shown && (
        <p className="mt-4 text-xs text-faint">
          Counts from OpenStreetMap. Indicative, not exhaustive.
        </p>
      )}
    </div>
  )
}

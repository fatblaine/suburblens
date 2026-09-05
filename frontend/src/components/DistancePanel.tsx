import { useState } from 'react'
import { useSuburbDistances } from '../api/suburbs'
import { CARD } from '../lib/theme'
import type { PoiDistance } from '../types/api'

// Straight-line distance to key POIs (universities + CBD) for one suburb.
// Shown on both the detail page (inside SuburbCard) and the compare page.

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

function PoiRow({ poi }: { poi: PoiDistance }) {
  const isCbd = poi.category === 'cbd'
  return (
    <li className="flex items-center justify-between gap-3 py-2 border-t border-white/[0.06] first:border-t-0">
      <div className="min-w-0">
        <span className="block text-sm text-fg font-sans truncate" title={poi.name}>
          {poi.shortName || poi.name}
        </span>
        <span
          className={`font-mono text-[10px] uppercase tracking-wider ${isCbd ? 'text-lemon' : 'text-dim'}`}
        >
          {isCbd ? 'City centre' : 'University'}
        </span>
      </div>
      <span className="font-mono text-sm text-muted shrink-0 tabular-nums">
        {formatDistance(poi.distanceMeters)}
      </span>
    </li>
  )
}

export default function DistancePanel({
  salCode,
  collapsible = false,
  defaultOpen = false,
}: {
  salCode: string
  /** Compare page folds this away by default so the column stays scannable. */
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const { data, isPending, isError } = useSuburbDistances(salCode)
  const [open, setOpen] = useState(defaultOpen)
  const shown = !collapsible || open

  // Out of scope / no centroid → 404 → hide the panel entirely.
  if (isError) return null

  if (isPending) {
    return (
      <div className={CARD + ' p-6'}>
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-24 bg-white/10 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="h-3 w-28 bg-white/10 rounded" />
              <div className="h-3 w-12 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.distances.length === 0) return null

  const header = (
    <>
      <p className="font-mono text-[11px] uppercase tracking-widest text-lemon">Getting Around</p>
      <h3 className="font-display text-lg font-semibold text-fg mt-1">Distances</h3>
    </>
  )

  return (
    <div className={CARD + ' p-6'}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          aria-expanded={open}
          className="w-full flex items-start justify-between gap-3 text-left"
        >
          <div>{header}</div>
          <span
            aria-hidden="true"
            className={`shrink-0 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          >
            ▼
          </span>
        </button>
      ) : (
        header
      )}

      {shown && (
        <>
          <ul className="mt-4">
            {data.distances.map(poi => (
              <PoiRow key={poi.code} poi={poi} />
            ))}
          </ul>

          <p className="mt-4 text-xs text-faint">Straight-line distance, not travel time.</p>
        </>
      )}
    </div>
  )
}

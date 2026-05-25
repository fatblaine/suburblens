import { useState } from 'react'
import { useNearbySuburbs } from '../api/suburbs'

interface Props {
  salCode: string
  defaultExpanded?: boolean
  onSelect: (salCode: string) => void
}

export default function NearbySuburbs({ salCode, defaultExpanded = false, onSelect }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { data, isPending, isError } = useNearbySuburbs(salCode, 5, expanded)

  return (
    <div className="mt-8">

      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between bg-white/10 border border-white/15 rounded-xl px-4 py-3 hover:border-white/30 hover:bg-white/15 transition text-white/70"
      >
        <span className="font-medium">Nearby Suburbs</span>
        <span className={`text-white/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2">

          {isPending && (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-white/10 rounded-xl animate-pulse" />
              ))}
            </>
          )}

          {isError && (
            <p className="text-sm text-red-400/80 px-1">Failed to load nearby suburbs.</p>
          )}

          {data && data.nearby.length === 0 && (
            <p className="text-sm text-white/40 px-1">No nearby suburbs found within 20 km.</p>
          )}

          {data && data.nearby.map((suburb) => (
            <button
              key={suburb.salCode}
              onClick={() => onSelect(suburb.salCode)}
              className="flex items-center justify-between bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-left hover:border-white/30 hover:bg-white/15 transition"
            >
              <div>
                <span className="font-medium text-white/90">{suburb.salName}</span>
                <span className="text-sm text-white/40 ml-2">{suburb.gccsaName}</span>
              </div>

              <span className="text-sm text-white/40 shrink-0 ml-4">
                {suburb.distanceMeters >= 1000
                  ? `${(suburb.distanceMeters / 1000).toFixed(1)} km`
                  : `${suburb.distanceMeters} m`}
              </span>
            </button>
          ))}

        </div>
      )}

    </div>
  )
}

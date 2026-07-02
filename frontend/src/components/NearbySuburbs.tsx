import { useState, useRef, useEffect, useCallback } from 'react'
import { useNearbySuburbs } from '../api/suburbs'

interface Props {
  salCode: string
  defaultExpanded?: boolean
  onSelect: (salCode: string) => void
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

export default function NearbySuburbs({ salCode, defaultExpanded = false, onSelect }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { data, isPending, isError } = useNearbySuburbs(salCode, 5, expanded)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  // Gate the arrows + edge fades on how far the row is scrolled.
  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  // Recompute once the row mounts / data arrives, and on viewport resize
  // (clientWidth changes what's still scrollable).
  useEffect(() => {
    updateArrows()
    window.addEventListener('resize', updateArrows)
    return () => window.removeEventListener('resize', updateArrows)
  }, [data, expanded, updateArrows])

  function scrollByPage(dir: 1 | -1) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className="mt-8">

      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between bg-surface-2 border border-white/10 rounded-xl px-4 py-3 hover:border-white/25 hover:bg-surface-3 transition text-fg"
      >
        <span className="font-medium">Nearby Suburbs</span>
        <span className={`text-faint transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {expanded && (
        <div className="mt-2">

          {isPending && (
            <div className="flex gap-2 overflow-hidden">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="shrink-0 w-36 h-[62px] bg-surface-2 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-rented px-1">Failed to load nearby suburbs.</p>
          )}

          {data && data.nearby.length === 0 && (
            <p className="text-sm text-faint px-1">No nearby suburbs found within 20 km.</p>
          )}

          {data && data.nearby.length > 0 && (
            <div className="relative">

              {/* Horizontal snap row. Native scrollbar hidden — arrows + edge
                  fades are the scroll affordance. */}
              <div
                ref={scrollRef}
                onScroll={updateArrows}
                className="flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1
                           [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {data.nearby.map((suburb) => (
                  <button
                    key={suburb.salCode}
                    onClick={() => onSelect(suburb.salCode)}
                    title={suburb.salName}
                    className="snap-start shrink-0 w-36 bg-surface-2 border border-white/10 rounded-xl px-4 py-3 text-left hover:border-lemon/30 hover:bg-surface-3 transition"
                  >
                    <span className="block font-medium text-fg text-sm truncate">{suburb.salName}</span>
                    <span className="block font-mono text-xs text-muted mt-1">
                      {formatDistance(suburb.distanceMeters)}
                    </span>
                  </button>
                ))}
              </div>

              {/* Edge fades (only when there's more in that direction) */}
              {canLeft && (
                <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-ink to-transparent z-10" />
              )}
              {canRight && (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-ink to-transparent z-10" />
              )}

              {/* Arrow controls (desktop wheel can't scroll horizontally) */}
              {canLeft && (
                <button
                  aria-label="Scroll to previous suburbs"
                  onClick={() => scrollByPage(-1)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-8 h-8 rounded-full bg-ink/80 border border-white/15 text-fg hover:bg-surface-3 transition"
                >
                  ‹
                </button>
              )}
              {canRight && (
                <button
                  aria-label="Scroll to more suburbs"
                  onClick={() => scrollByPage(1)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-8 h-8 rounded-full bg-ink/80 border border-white/15 text-fg hover:bg-surface-3 transition"
                >
                  ›
                </button>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  )
}

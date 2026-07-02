import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

type City = 'sydney' | 'melbourne'

// RSI segment colours (kept in sync with ShiftIndexCard / Legend below).
const RSI_COLOR_EXPR: maplibregl.ExpressionSpecification = [
  'case',
  ['==', ['get', 'residencyShiftIndex'], null], '#374151', // no data -> dark grey
  ['>=', ['get', 'residencyShiftIndex'], 3], '#16a34a',    // strong ownership -> green
  ['>=', ['get', 'residencyShiftIndex'], 1], '#86efac',    // mild ownership -> light green
  ['>=', ['get', 'residencyShiftIndex'], -1], '#6b7280',   // stable -> grey
  ['>=', ['get', 'residencyShiftIndex'], -3], '#f97316',   // mild rental -> orange
  '#ef4444',                                               // strong rental (<= -3) -> red
]

const CITY_CENTERS: Record<City, { center: [number, number]; zoom: number }> = {
  sydney: { center: [151.09, -33.87], zoom: 10 },
  melbourne: { center: [144.96, -37.81], zoom: 10 },
}

interface PanelSuburb {
  salCode: string
  salName: string
  stateName: string
  residencyShiftIndex: number | null
  trendLabel: string
}

// MapLibre serialises GeoJSON feature properties; coerce defensively so we
// never trust a raw `unknown`/string where the API may have sent null.
function toPanelSuburb(props: Record<string, unknown>): PanelSuburb {
  const rsi = props.residencyShiftIndex
  return {
    salCode: String(props.salCode ?? ''),
    salName: String(props.salName ?? ''),
    stateName: String(props.stateName ?? ''),
    residencyShiftIndex:
      rsi === null || rsi === undefined || rsi === '' || rsi === 'null'
        ? null
        : Number(rsi),
    trendLabel: String(props.trendLabel ?? ''),
  }
}

export default function MapPage() {
  const navigate = useNavigate()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [city, setCity] = useState<City>('sydney')
  const [panel, setPanel] = useState<PanelSuburb | null>(null)
  const [loading, setLoading] = useState(true)

  // Load GeoJSON for a city and (re)build the layers.
  const loadSuburbs = useCallback(async (targetCity: City) => {
    const m = map.current
    if (!m) return
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/suburbs/heatmap?city=${targetCity}`)
      if (!res.ok) throw new Error('Failed to load heatmap data.')
      const geojson = await res.json()

      // Remove existing layers/source first (switching cities).
      for (const id of ['suburbs-fill', 'suburbs-line', 'suburbs-label']) {
        if (m.getLayer(id)) m.removeLayer(id)
      }
      if (m.getSource('suburbs')) m.removeSource('suburbs')

      m.addSource('suburbs', { type: 'geojson', data: geojson })

      m.addLayer({
        id: 'suburbs-fill',
        type: 'fill',
        source: 'suburbs',
        paint: { 'fill-color': RSI_COLOR_EXPR, 'fill-opacity': 0.65 },
      })

      m.addLayer({
        id: 'suburbs-line',
        type: 'line',
        source: 'suburbs',
        paint: { 'line-color': 'rgba(255,255,255,0.2)', 'line-width': 0.8 },
      })

      m.addLayer({
        id: 'suburbs-label',
        type: 'symbol',
        source: 'suburbs',
        minzoom: 12,
        layout: { 'text-field': ['get', 'salName'], 'text-size': 11, 'text-anchor': 'center' },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.6)',
          'text-halo-width': 1.5,
        },
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initialise the map exactly once (StrictMode-safe via the map.current guard).
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/dark', // free, no token
      center: CITY_CENTERS.sydney.center,
      zoom: CITY_CENTERS.sydney.zoom,
    })
    map.current = m

    m.addControl(new maplibregl.NavigationControl(), 'top-right')
    m.on('error', (e) => console.error('[MapLibre]', e.error))

    // Hover highlight: bump opacity for the hovered suburb.
    let hoveredId: string | null = null
    m.on('mousemove', 'suburbs-fill', (e) => {
      if (!e.features?.length) return
      const id = String(e.features[0].properties?.salCode ?? '')
      if (hoveredId !== id) {
        hoveredId = id
        m.setPaintProperty('suburbs-fill', 'fill-opacity', [
          'case', ['==', ['get', 'salCode'], hoveredId], 0.9, 0.65,
        ])
      }
      m.getCanvas().style.cursor = 'pointer'
    })
    m.on('mouseleave', 'suburbs-fill', () => {
      hoveredId = null
      m.setPaintProperty('suburbs-fill', 'fill-opacity', 0.65)
      m.getCanvas().style.cursor = ''
    })

    // Click -> open side panel.
    m.on('click', 'suburbs-fill', (e) => {
      if (!e.features?.length) return
      setPanel(toPanelSuburb(e.features[0].properties ?? {}))
    })

    m.on('load', () => {
      loadSuburbs('sydney')
    })

    return () => {
      m.remove()
      map.current = null
    }
  }, [loadSuburbs])

  function switchCity(target: City) {
    if (target === city) return
    setCity(target)
    setPanel(null)
    map.current?.flyTo({
      center: CITY_CENTERS[target].center,
      zoom: CITY_CENTERS[target].zoom,
      duration: 1200,
    })
    loadSuburbs(target)
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">

      {/* Map container. Inline position/inset because MapLibre's own
          `.maplibregl-map { position: relative }` (added to this element) would
          otherwise override Tailwind's `.absolute`, collapsing the box to 0
          height. Inline styles outrank class selectors, so this always wins. */}
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

      {/* Top bar. `pointer-events-none` on the container so its transparent
          full-width gaps don't intercept clicks meant for the map / the
          top-right zoom control beneath it; interactive children opt back in. */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        <button
          onClick={() => navigate('/')}
          className="pointer-events-auto bg-black/50 backdrop-blur text-white/70 hover:text-white px-3 py-1.5 rounded-lg text-sm border border-white/10"
        >
          ← Back
        </button>
        <div className="pointer-events-auto bg-black/50 backdrop-blur border border-white/10 rounded-lg p-1 flex gap-1">
          {(['sydney', 'melbourne'] as const).map((c) => (
            <button
              key={c}
              onClick={() => switchCity(c)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                city === c ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {c === 'sydney' ? 'Sydney' : 'Melbourne'}
            </button>
          ))}
        </div>
        {loading && (
          <span className="text-white/50 text-sm bg-black/40 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10">
            Loading…
          </span>
        )}
      </div>

      {/* Right slide panel */}
      {panel && (
        <SlidePanel
          suburb={panel}
          onClose={() => setPanel(null)}
          onViewDetails={() => navigate(`/suburb/${panel.salCode}`)}
        />
      )}

      {/* Bottom legend */}
      <Legend />

    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function SlidePanel({
  suburb,
  onClose,
  onViewDetails,
}: {
  suburb: PanelSuburb
  onClose: () => void
  onViewDetails: () => void
}) {
  const rsi = suburb.residencyShiftIndex

  const TREND_STYLE: Record<string, { color: string; label: string }> = {
    strong_ownership_shift: { color: 'text-green-400', label: 'Strong ownership shift' },
    mild_ownership_shift: { color: 'text-green-300', label: 'Mild ownership shift' },
    stable: { color: 'text-gray-400', label: 'Stable' },
    mild_rental_shift: { color: 'text-orange-400', label: 'Mild rental shift' },
    strong_rental_shift: { color: 'text-red-400', label: 'Strong rental shift' },
  }
  const style = TREND_STYLE[suburb.trendLabel] ?? { color: 'text-white/40', label: '—' }

  return (
    <>
      {/* Backdrop — mobile only: tap outside the sheet to close. Desktop keeps
          the map interactive (narrow drawer, close via ×). */}
      <div className="absolute inset-0 z-10 sm:hidden" onClick={onClose} />

      {/* Mobile: bottom sheet. Desktop (sm+): right drawer. */}
      <div
        className="absolute z-20 flex flex-col gap-4 overflow-y-auto
                   bg-black/60 backdrop-blur-md
                   bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl border-t border-white/10 p-6
                   sm:top-0 sm:right-0 sm:bottom-auto sm:left-auto sm:h-full sm:max-h-none
                   sm:w-72 sm:rounded-none sm:border-t-0 sm:border-l"
      >
        {/* Drag-handle affordance (mobile only) */}
        <div className="sm:hidden mx-auto -mt-2 h-1 w-10 rounded-full bg-white/25" />

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">{suburb.salName}</h2>
          <p className="text-white/50 text-sm mt-0.5">{suburb.stateName}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-m-2 p-2 text-white/40 hover:text-white/80 text-xl leading-none ml-2"
        >
          ×
        </button>
      </div>

      <div className="bg-white/10 border border-white/15 rounded-xl p-4">
        <p className="text-white/50 text-xs mb-1">Residency Shift Index</p>
        <p className="text-white text-2xl font-bold">{rsi != null ? rsi.toFixed(1) : '—'}</p>
        <p className={`text-sm mt-1 font-medium ${style.color}`}>{style.label}</p>
        <p className="text-white/30 text-xs mt-2">SuburbLens Custom · Not an ABS metric</p>
      </div>

        <button
          onClick={onViewDetails}
          className="mt-auto w-full bg-white/15 hover:bg-white/25 border border-white/20
                     text-white text-sm font-medium py-2.5 rounded-xl transition-all"
        >
          View full details →
        </button>
      </div>
    </>
  )
}

function Legend() {
  const items = [
    { color: 'bg-green-700', label: 'Strong ownership' },
    { color: 'bg-green-300', label: 'Mild ownership' },
    { color: 'bg-gray-500', label: 'Stable' },
    { color: 'bg-orange-400', label: 'Mild rental' },
    { color: 'bg-red-500', label: 'Strong rental' },
    { color: 'bg-gray-700', label: 'No data' },
  ]

  return (
    <div className="absolute bottom-6 left-4 z-10 max-w-[calc(100vw-2rem)]
                    bg-black/50 backdrop-blur border border-white/10
                    rounded-xl px-4 py-3 flex gap-x-4 gap-y-2 flex-wrap">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded-sm ${color} opacity-80`} />
          <span className="text-white/60 text-xs">{label}</span>
        </div>
      ))}
    </div>
  )
}

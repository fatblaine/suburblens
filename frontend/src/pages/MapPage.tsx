import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import PageMeta from '../components/PageMeta'
import { useSuburbSearch, maybeWarmup } from '../api/suburbs'
import type { SuburbSearchResult } from '../types/api'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

type City = 'sydney' | 'melbourne'

// Which city a search result belongs to (results span both cities; the map
// only holds one at a time). gccsaName is "Greater Sydney" / "Greater Melbourne".
function cityOf(gccsaName: string): City {
  return gccsaName.includes('Melbourne') ? 'melbourne' : 'sydney'
}

// Minimal shapes for the heatmap GeoJSON. Deliberately local rather than the
// global `GeoJSON` namespace, which isn't in scope under the CI build (`tsc -b`).
interface MapGeometry { type: string; coordinates: unknown }
interface MapFeature { properties: Record<string, unknown> | null; geometry: MapGeometry | null }
interface MapFeatureCollection { features: MapFeature[] }

// Bounding box of a Polygon/MultiPolygon as [[west,south],[east,north]], or
// null if it has no coordinates. Recurses through the nested coordinate arrays.
function bboxOf(geom: MapGeometry | null | undefined): [[number, number], [number, number]] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const visit = (arr: unknown): void => {
    if (!Array.isArray(arr)) return
    if (typeof arr[0] === 'number') {
      const [x, y] = arr as number[]
      if (x < minX) minX = x; if (y < minY) minY = y
      if (x > maxX) maxX = x; if (y > maxY) maxY = y
      return
    }
    for (const c of arr) visit(c)
  }
  if (!geom) return null
  visit(geom.coordinates)
  if (minX === Infinity) return null
  return [[minX, minY], [maxX, maxY]]
}

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
  // Raw GeoJSON for the currently-loaded city — lets search look a suburb up by
  // salCode and compute its bounds without re-querying the map source.
  const featuresRef = useRef<MapFeatureCollection | null>(null)
  // The salCode currently outlined in lemon (from a search pick), so the
  // highlight can be re-applied after a layer rebuild and cleared on close.
  const selectedCodeRef = useRef<string | null>(null)
  const [city, setCity] = useState<City>('sydney')
  const [panel, setPanel] = useState<PanelSuburb | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load GeoJSON for a city and (re)build the layers.
  const loadSuburbs = useCallback(async (targetCity: City) => {
    const m = map.current
    if (!m) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/suburbs/heatmap?city=${targetCity}`)
      if (!res.ok) throw new Error('Failed to load heatmap data.')
      const geojson = await res.json()
      featuresRef.current = geojson

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
        minzoom: 10,
        layout: { 'text-field': ['get', 'salName'], 'text-size': 11, 'text-anchor': 'center' },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.6)',
          'text-halo-width': 1.5,
        },
      })
    } catch (err) {
      if (import.meta.env.DEV) console.error(err)
      setError('Could not load map data. Please try again.')
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
    m.on('error', (e) => { if (import.meta.env.DEV) console.error('[MapLibre]', e.error) })

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
    clearHighlight()
    map.current?.flyTo({
      center: CITY_CENTERS[target].center,
      zoom: CITY_CENTERS[target].zoom,
      duration: 1200,
    })
    loadSuburbs(target)
  }

  // Outline one suburb in lemon (an expression over the whole line layer, so it
  // survives pans/zooms). Reapplied after a city's layers are rebuilt.
  function applyHighlight(m: maplibregl.Map, salCode: string) {
    selectedCodeRef.current = salCode
    if (!m.getLayer('suburbs-line')) return
    m.setPaintProperty('suburbs-line', 'line-color',
      ['case', ['==', ['get', 'salCode'], salCode], '#c6f24e', 'rgba(255,255,255,0.2)'])
    m.setPaintProperty('suburbs-line', 'line-width',
      ['case', ['==', ['get', 'salCode'], salCode], 2.5, 0.8])
  }

  function clearHighlight() {
    selectedCodeRef.current = null
    const m = map.current
    if (!m || !m.getLayer('suburbs-line')) return
    m.setPaintProperty('suburbs-line', 'line-color', 'rgba(255,255,255,0.2)')
    m.setPaintProperty('suburbs-line', 'line-width', 0.8)
  }

  function closePanel() {
    setPanel(null)
    clearHighlight()
  }

  // Fly to a suburb, outline it, and open its panel. Reads geometry + RSI from
  // the loaded GeoJSON, so no extra request.
  function locate(salCode: string) {
    const m = map.current
    const feature = featuresRef.current?.features.find(
      f => String(f.properties?.salCode ?? '') === salCode,
    )
    if (!m || !feature) return
    const b = bboxOf(feature.geometry)
    if (b) m.fitBounds(b, { padding: 80, duration: 1000, maxZoom: 14 })
    applyHighlight(m, salCode)
    setPanel(toPanelSuburb(feature.properties ?? {}))
  }

  // Search pick: switch city first if the suburb is in the other city (the map
  // holds one city at a time), then locate once its data has loaded.
  async function focusSuburb(result: SuburbSearchResult) {
    const target = cityOf(result.gccsaName)
    if (target !== city) {
      setCity(target)
      await loadSuburbs(target)
    }
    locate(result.salCode)
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <PageMeta
        title="Ownership-to-rental map of Sydney & Melbourne | SuburbLens"
        description="Browse every Sydney and Melbourne suburb on a map, shaded by how far it has shifted between owner-occupied and rented since 2011."
      />

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
        <MapSearch onSelect={focusSuburb} />
        {loading && (
          <span className="text-white/50 text-sm bg-black/40 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10">
            Loading…
          </span>
        )}
        {error && !loading && (
          <span className="pointer-events-auto text-red-300 text-sm bg-black/40 backdrop-blur px-3 py-1.5 rounded-lg border border-red-400/30">
            {error}
          </span>
        )}
      </div>

      {/* Right slide panel */}
      {panel && (
        <SlidePanel
          suburb={panel}
          onClose={closePanel}
          onViewDetails={() => navigate(`/suburb/${panel.salCode}`)}
        />
      )}

      {/* Bottom legend */}
      <Legend />

    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────

// Compact suburb search for the map top bar. Reuses the shared debounced
// search hook; picking a result hands the suburb to the map (fly + highlight).
function MapSearch({ onSelect }: { onSelect: (s: SuburbSearchResult) => void }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: results, isPending } = useSuburbSearch(debounced)
  const show = open && debounced.trim().length >= 2

  function pick(s: SuburbSearchResult) {
    onSelect(s)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="pointer-events-auto relative w-56 sm:w-64">
      <div className="flex items-center gap-2 bg-black/50 backdrop-blur border border-white/10 rounded-lg px-3 focus-within:border-lemon/60 transition-colors">
        <span className="text-white/40 select-none text-sm">⌕</span>
        <input
          type="text"
          value={query}
          placeholder="Search a suburb…"
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && show && !isPending && results?.length) {
              e.preventDefault(); pick(results[0])
            }
          }}
          onFocus={() => { setOpen(true); maybeWarmup() }}
          className="flex-1 py-2 bg-transparent text-white placeholder:text-white/40 focus:outline-none text-sm"
        />
      </div>

      {show && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/70 backdrop-blur border border-white/10 rounded-lg shadow-2xl shadow-black/50 overflow-hidden max-h-72 overflow-y-auto">
          {isPending && <div className="px-3 py-2 text-sm text-white/50">Searching…</div>}
          {!isPending && results?.length === 0 && (
            <div className="px-3 py-2 text-sm text-white/50">No suburbs found.</div>
          )}
          {results?.map((s) => (
            <button
              key={s.salCode}
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors border-b border-white/[0.06] last:border-0"
            >
              <span className="text-white text-sm font-medium">{s.salName}</span>
              <span className="ml-2 text-xs text-white/45">{s.gccsaName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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

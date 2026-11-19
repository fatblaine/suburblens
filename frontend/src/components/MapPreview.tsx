import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as maplibregl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { MAP_STYLE_URL, RSI_BANDS, RSI_COLOR_EXPR } from '../lib/mapStyle'
import { track } from '../lib/analytics'

maplibregl.setWorkerUrl(maplibreWorkerUrl)

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// Inner Sydney: CBD, Inner West and the Burwood/Strathfield corridor, zoomed in
// enough to show suburb names. Same basemap, data and colours as /map.
const VIEW = { center: [151.13, -33.88] as [number, number], zoom: 11.3 }

// A real, read-only slice of the /map heatmap for the home page. The whole
// preview is one link to /map; the map itself takes no input. It only starts
// (tiles + heatmap GeoJSON) once the section is about to scroll into view, so
// the first screen never pays for it.
export default function MapPreview() {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = box.current
    // No IntersectionObserver (old browsers, test DOMs): skip the live map; the
    // dark panel, legend and link still render.
    if (!el || typeof IntersectionObserver === 'undefined') return

    let map: maplibregl.Map | null = null
    let cancelled = false

    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return
      io.disconnect()

      map = new maplibregl.Map({
        container: el,
        style: MAP_STYLE_URL,
        center: VIEW.center,
        zoom: VIEW.zoom,
        interactive: false,
        attributionControl: { compact: true },
      })
      map.on('error', e => { if (import.meta.env.DEV) console.error('[MapPreview]', e.error) })

      map.on('load', async () => {
        try {
          const res = await fetch(`${API_BASE}/api/suburbs/heatmap?city=sydney`)
          if (!res.ok || cancelled || !map) return
          const geojson = await res.json()
          if (cancelled || !map) return
          map.addSource('suburbs', { type: 'geojson', data: geojson })
          map.addLayer({ id: 'suburbs-fill', type: 'fill', source: 'suburbs', paint: { 'fill-color': RSI_COLOR_EXPR, 'fill-opacity': 0.65 } })
          map.addLayer({ id: 'suburbs-line', type: 'line', source: 'suburbs', paint: { 'line-color': 'rgba(255,255,255,0.2)', 'line-width': 0.8 } })
          map.addLayer({
            id: 'suburbs-label',
            type: 'symbol',
            source: 'suburbs',
            layout: { 'text-field': ['get', 'salName'], 'text-size': 11, 'text-anchor': 'center' },
            paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1.5 },
          })
          setReady(true)
        } catch (err) {
          if (import.meta.env.DEV) console.error('[MapPreview]', err)
        }
      })
    }, { rootMargin: '300px' })

    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
      map?.remove()
    }
  }, [])

  return (
    // Stacked (below lg): the map goes first, copy underneath. Side by side: map on the right.
    <div className="order-first lg:order-none flex-[1_1_480px] min-w-0 min-h-[220px] sm:min-h-[320px] lg:min-h-[360px] relative bg-ink-2">
      {/* maplibre-gl.css forces the container to position:relative, so it can't
          be the absolutely positioned layer itself: size it inside one. */}
      <div className="absolute inset-0" aria-hidden="true">
        <div ref={box} className="w-full h-full" />
      </div>
      {!ready && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-surface-2/40" />}

      {/* The whole panel opens the full map. */}
      <Link
        to="/map"
        onClick={() => track('home_map_click', { placement: 'preview' })}
        aria-label="Open the map"
        className="absolute inset-0 z-[1]"
      />

      {/* Phones: top-left, so it doesn't sit on the map credit at the bottom. */}
      <div className="absolute left-2.5 top-2.5 sm:top-auto sm:left-4 sm:bottom-4 z-[2] pointer-events-none rounded-lg sm:rounded-xl bg-surface/95 border border-white/[0.08] px-2.5 py-2 sm:px-3.5 sm:py-3 font-mono text-[10px] sm:text-[11px] text-muted">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
          <span className="text-fg uppercase tracking-[0.08em]">Residency Shift</span>
          <span className="px-1 sm:px-1.5 py-px rounded border border-white/15 text-[9px] sm:text-[10px] text-faint">SuburbLens Custom</span>
        </div>
        <div className="flex h-1.5 sm:h-2 rounded-sm overflow-hidden w-[150px] sm:w-[200px]">
          {RSI_BANDS.map(b => <div key={b.label} className="flex-1" style={{ background: b.color }} />)}
        </div>
        <div className="flex justify-between mt-1.5"><span>Owning</span><span>Renting</span></div>
      </div>
    </div>
  )
}

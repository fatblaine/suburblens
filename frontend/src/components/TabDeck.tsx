import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../lib/useReducedMotion'
import type { Tab } from './TabStrip'

// How far past the card's own width the deck may bleed, per side. Desktop has
// margin to spare, so it gets a wider strip; narrow viewports are capped by the
// page's own padding anyway.
const MAX_PEEK = 56
const MAX_PEEK_WIDE = 120
const WIDE_FROM = 1024

/**
 * Which panel is closest to the middle of the viewport, by centre point.
 *
 * Not `round(scrollLeft / trackWidth)`: panels sit in a track that is wider than
 * they are, so that ratio drifts further out of step with every tab.
 * Exported for the unit test — it is the only real arithmetic here.
 */
export function nearestIndex(centers: number[], trackCenter: number): number {
  let best = 0
  let bestGap = Infinity
  centers.forEach((c, i) => {
    const gap = Math.abs(c - trackCenter)
    if (gap < bestGap) {
      bestGap = gap
      best = i
    }
  })
  return best
}

/**
 * A horizontal snap track of tab panels. Swiping (touch, trackpad, shift+wheel)
 * moves between tabs, and a sliver of the neighbouring panel stays visible so it
 * is obvious the content continues sideways.
 *
 * The sliver lives OUTSIDE the card, in the page's margin: the deck bleeds up to
 * MAX_PEEK past the card on each side, and every panel keeps the card's full
 * width. Narrowing the panels instead would clip the tab the reader is actually
 * on, which is worse than no hint at all.
 *
 * Native scrolling on purpose — no pointer-drag handler. The panels contain
 * Recharts charts that own their own pointer events for tooltips, and the
 * Overview tab contains another horizontal scroller (NearbySuburbs); capturing
 * pointers on an ancestor would break both.
 *
 * Mouse-only desktop users get no drag; they keep the tab strip, its ‹ › arrows,
 * the keyboard, and the prev/next nav below the deck.
 */
export default function TabDeck({
  tabs,
  active,
  onSelect,
  idPrefix,
  renderPanel,
}: {
  tabs: Tab[]
  active: number
  onSelect: (i: number) => void
  /** Namespaces the panel ids — must match the TabStrip's. Pass the salCode. */
  idPrefix: string
  renderPanel: (key: string) => React.ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])
  const reducedMotion = useReducedMotion()

  // Card width, and how far we may bleed past it. Measured rather than done in
  // CSS with 100vw: vw units include the vertical scrollbar, which would push a
  // horizontal scrollbar onto the whole page.
  const [geom, setGeom] = useState<{ card: number; peek: number }>()

  // Track height follows the ACTIVE panel. Panels differ by ~2x (Housing is
  // roughly twice Local Area), and a flex row is as tall as its tallest child,
  // so without this a short tab would sit under a screenful of dead space.
  const [height, setHeight] = useState<number>()
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  // A programmatic scrollTo fires the same scroll events a swipe does, and a
  // smooth one travels THROUGH the intermediate tabs on its way. Without this
  // flag, clicking "Education" from "Overview" would commit Housing, then Local
  // Area, then Community, rewriting ?tab= at each one.
  const programmatic = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const releaseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Measure the parent, not the deck: the deck sets its own width, but the
  // parent still reports the width the card would have had.
  useLayoutEffect(() => {
    const measure = () => {
      const card = rootRef.current?.parentElement?.clientWidth ?? 0
      const viewport = document.documentElement.clientWidth
      if (!card || !viewport) return
      const cap = viewport >= WIDE_FROM ? MAX_PEEK_WIDE : MAX_PEEK
      const peek = Math.max(0, Math.min(cap, (viewport - card) / 2))
      setGeom(g => (g && g.card === card && g.peek === peek ? g : { card, peek }))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const updateFades = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  // Measure in a layout effect: on the first frame the track has no height set,
  // so it would paint at the tallest panel's height before settling down.
  useLayoutEffect(() => {
    const panel = panelRefs.current[active]
    if (!panel) return

    const measure = () => {
      const h = panel.offsetHeight
      // Guard the no-op: jsdom reports 0, and sub-pixel churn would otherwise
      // re-render on every observer tick.
      setHeight(prev => (h > 0 && (prev === undefined || Math.abs(prev - h) > 1) ? h : prev))
    }
    measure()

    if (typeof ResizeObserver === 'undefined') return
    // Panels change height after mount for several reasons: a query resolves and
    // a skeleton becomes a chart, the reader collapses a Panel header, or the
    // Community sub-toggle swaps in a differently-sized chart.
    const ro = new ResizeObserver(measure)
    ro.observe(panel)
    return () => ro.disconnect()
  }, [active, tabs.length, geom])

  // Active tab changed elsewhere (strip click, ?tab= in the URL, back button):
  // bring that panel into view.
  useEffect(() => {
    const el = trackRef.current
    const panel = panelRefs.current[active]
    if (!el || !panel || !el.clientWidth) return

    const target = Math.max(0, panel.offsetLeft - (el.clientWidth - panel.offsetWidth) / 2)
    // Already there — a swipe put us here, so scrolling again would fight it.
    if (Math.abs(el.scrollLeft - target) < 2) return

    programmatic.current = true
    clearTimeout(releaseTimer.current)
    // 'instant', not 'auto': 'auto' resolves to the computed CSS scroll-behavior.
    el.scrollTo({ left: target, behavior: reducedMotion ? 'instant' : 'smooth' })
    releaseTimer.current = setTimeout(() => { programmatic.current = false }, 450)
  }, [active, reducedMotion, geom])

  // Commit the tab only once the scroll has settled — never mid-flick, which
  // would fire selectTab (and a URL write) for every tab swept past.
  const commit = useCallback(() => {
    const el = trackRef.current
    if (!el || programmatic.current || !el.clientWidth) return
    const centers = panelRefs.current.map(p => (p ? p.offsetLeft + p.offsetWidth / 2 : NaN))
    if (centers.some(Number.isNaN)) return
    const i = nearestIndex(centers, el.scrollLeft + el.clientWidth / 2)
    if (i !== active) onSelect(i)
  }, [active, onSelect])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    // scrollend is the real signal; the timer is the fallback for browsers
    // without it. Both funnel into the same commit.
    const onScrollEnd = () => {
      programmatic.current = false
      clearTimeout(settleTimer.current)
      commit()
    }
    const target: EventTarget = el
    target.addEventListener('scrollend', onScrollEnd)
    return () => target.removeEventListener('scrollend', onScrollEnd)
  }, [commit])

  useEffect(() => () => {
    clearTimeout(settleTimer.current)
    clearTimeout(releaseTimer.current)
  }, [])

  const onScroll = () => {
    updateFades()
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(commit, 120)
  }

  useEffect(updateFades, [updateFades, tabs.length, height, geom])

  useEffect(() => {
    window.addEventListener('resize', updateFades)
    return () => window.removeEventListener('resize', updateFades)
  }, [updateFades])

  // Exactly the bleed, never wider: the gradient has to reach transparent by the
  // time it meets the active panel's edge, or it darkens the tab being read —
  // barely visible at desktop's 120px bleed, a 55% wash at mobile's 16px.
  const fadeWidth = geom?.peek ?? 0

  return (
    <div
      ref={rootRef}
      className="relative"
      style={geom ? { width: geom.card + geom.peek * 2, marginLeft: -geom.peek } : undefined}
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          ...(height ? { height } : null),
          ...(geom ? { paddingLeft: geom.peek, paddingRight: geom.peek } : null),
        }}
        // items-start is load-bearing: the default `stretch` would size every
        // panel to the tallest one and make the measurement above meaningless.
        // overflow-y-hidden because overflow-x-auto forces the other axis to a
        // scroll container anyway — this clips the taller peeking neighbour
        // rather than letting it stretch the deck.
        className={`flex items-start overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-mandatory
                    [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
                    ${reducedMotion ? '' : 'transition-[height] duration-200'}`}
      >
        {tabs.map((t, i) => (
          <div
            key={t.key}
            ref={el => { panelRefs.current[i] = el }}
            role="tabpanel"
            id={`${idPrefix}-panel-${t.key}`}
            aria-labelledby={`${idPrefix}-tab-${t.key}`}
            // inert keeps Tab-key focus and screen readers out of the panels
            // that are only peeking, and stops the browser scrolling a focused
            // control inside them into view.
            inert={i !== active}
            // min-w-0 so content cannot push a panel past the card width and
            // drag the active tab half off screen.
            // snap-always so a fast fling cannot skip past two tabs at once.
            className={`flex min-w-0 shrink-0 grow-0 flex-col gap-3.5 snap-center snap-always
                        ${reducedMotion ? '' : 'transition-opacity duration-200'}
                        ${i === active ? '' : 'opacity-40'}`}
            style={geom ? { width: geom.card } : { width: '100%' }}
          >
            {renderPanel(t.key)}
          </div>
        ))}
      </div>

      {/* Edge fades over the bleed, so the neighbour dissolves into the page
          rather than ending on a hard vertical cut. from-ink because the deck
          sits on the page background, not on a surface. */}
      {canLeft && fadeWidth > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-ink to-transparent z-10"
          style={{ width: fadeWidth }}
        />
      )}
      {canRight && fadeWidth > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-ink to-transparent z-10"
          style={{ width: fadeWidth }}
        />
      )}
    </div>
  )
}

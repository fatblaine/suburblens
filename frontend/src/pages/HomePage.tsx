import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SearchBox from '../components/SearchBox'
import AgentChat from '../components/AgentChat'
import PopularSuburbs from '../components/PopularSuburbs'
import TopSuburbCard from '../components/TopSuburbCard'
import MostViewedSection from '../components/MostViewedSection'
import MapPreview from '../components/MapPreview'
import AuthBadge from '../components/AuthBadge'
import PageMeta from '../components/PageMeta'
import Footer from '../components/Footer'
import type { SuburbSearchResult } from '../types/api'
import { track } from '../lib/analytics'
import { isNativeApp } from '../lib/platform'

const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/suburblens/ipibeapbfhilcffdbaeihcholjjdchej'

const NAV_LINKS = [
  { to: '/map', label: 'Map' },
  { to: '/suburbs', label: 'All suburbs' },
  { to: '/methodology', label: 'Methodology' },
  { to: '/about', label: 'About' },
]

// Home = two levels.
//   1. Search (first screen): the multi-select search is the one primary
//      action; the #1 most-viewed suburb sits beside it as a preview.
//   2. Guide (on scroll): Most viewed → Map → Ask AI. The top of the guide
//      peeks in below the search screen and each section fades in as it enters
//      the viewport (.reveal in index.css). Every "+" in the guide feeds the
//      search box; every card opens the existing profile page.
export default function HomePage() {
  const [selected, setSelected] = useState<SuburbSearchResult[]>([])
  const navigate = useNavigate()

  function handleAdd(suburb: SuburbSearchResult) {
    setSelected(prev =>
      prev.some(s => s.salCode === suburb.salCode) ? prev : [...prev, suburb]
    )
  }

  function handleRemove(salCode: string) {
    setSelected(prev => prev.filter(s => s.salCode !== salCode))
  }

  function handleCompare() {
    const params = new URLSearchParams()
    selected.forEach(s => params.append('codes', s.salCode))
    navigate(`/compare?${params}`)
  }

  function handleNearby() {
    // 只有 1 个 suburb 时才会调用，直接取第一个
    // nearby=1 告诉详情页默认展开周边列表
    navigate(`/suburb/${selected[0].salCode}?nearby=1`)
  }

  return (
    <main className="min-h-screen bg-ink animate-fade-in">
      <PageMeta
        title="SuburbLens: see what a Sydney or Melbourne suburb is actually like"
        description="Compare suburbs using ABS Census data: who owns, who rents, and how that has shifted since 2011, plus community languages, countries of birth, and education levels."
      />

      {/* ── Header ─────────────────────────────────────── */}
      {/* Same 1240px column as the content, so the right-hand controls line up
          with the cards below. The auth badge renders inline here (the global
          fixed one hides itself on "/"). */}
      <header className="border-b border-white/[0.06]">
        <div className="max-w-[1240px] mx-auto px-6 sm:px-8 py-4 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 font-display font-bold text-lg text-fg">
            <img src="/logo.svg" alt="" className="w-7 h-7" />
            SuburbLens
          </Link>
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-muted transition-colors hover:text-fg"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {/* A Chrome extension is useless on an iPhone (see Footer). */}
            {!isNativeApp && (
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="Check any suburb while you browse listings"
                onClick={() => track('extension_click', { placement: 'home_header' })}
                className="hidden lg:inline-flex shrink-0 items-center rounded-lg border border-white/15 px-3.5 py-2.5 font-mono text-xs text-fg transition-colors hover:border-lemon/60 hover:text-lemon"
              >
                Chrome extension
              </a>
            )}
            <AuthBadge inline />
          </div>
        </div>
      </header>

      {/* ── Level 1 · Search ───────────────────────────── */}
      <section
        aria-label="Search"
        className="max-w-[1240px] mx-auto px-6 sm:px-8 pt-12 sm:pt-16 pb-14 flex flex-wrap items-center gap-12 lg:gap-14"
      >
        <div className="flex-[1_1_520px] min-w-0">
          <div className="font-mono text-xs tracking-[0.16em] uppercase text-lemon mb-5">
            Compare multiple suburbs
          </div>
          <h1 className="font-display font-bold text-[40px] sm:text-5xl lg:text-[64px] leading-[1.03] tracking-tight text-fg mb-4">
            Know the suburb before you decide.
          </h1>
          <p className="text-[17px] leading-relaxed text-muted max-w-[520px] mb-8">
            Add one or several Sydney and Melbourne suburbs. See who owns, who rents, the
            languages spoken at home and more, straight from ABS Census data.
          </p>

          <div id="home-search" className="max-w-[620px] scroll-mt-24">
            <SearchBox
              selected={selected}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onCompare={handleCompare}
              onNearby={handleNearby}
            />
            {/* Most-viewed suburbs, last 30 days. Clicking one adds it to the
                search box above so the user can keep building a comparison. */}
            <PopularSuburbs selected={selected} onSelect={handleAdd} />
          </div>
        </div>

        <div className="flex-[1_1_400px] min-w-0">
          <TopSuburbCard />
        </div>
      </section>

      {/* ── Level 2 · Guide ────────────────────────────── */}
      <MostViewedSection selected={selected} onAdd={handleAdd} />

      {/* Map */}
      <section aria-labelledby="map-title" className="reveal max-w-[1240px] mx-auto px-6 sm:px-8 py-12">
        <div className="font-mono text-xs tracking-[0.16em] uppercase text-lemon mb-5">Explore the map</div>
        <div
          className="rounded-3xl border border-white/[0.08] overflow-hidden flex flex-wrap"
          style={{ background: 'linear-gradient(135deg, #15323a, #0d0f14)' }}
        >
          <div className="flex-[1_1_380px] min-w-0 p-8 sm:p-12 flex flex-col gap-4">
            <h2 id="map-title" className="font-display font-bold text-[28px] sm:text-[40px] leading-[1.1] tracking-tight">
              Watch a city change, one Census at a time.
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Every suburb in Sydney and Melbourne, shaded by how its mix of owners and renters
              shifted from 2011 to 2021. See where renters are moving.
            </p>
            <Link
              to="/map"
              onClick={() => track('home_map_click')}
              className="self-start mt-3 px-5 py-3.5 rounded-xl border border-white/15 text-fg text-[15px] font-semibold transition-colors hover:border-lemon/60 hover:text-lemon"
            >
              Open the map →
            </Link>
          </div>
          <MapPreview />
        </div>
      </section>

      {/* Ask AI */}
      <section aria-labelledby="ask-title" className="reveal max-w-[1240px] mx-auto px-6 sm:px-8 pt-12 pb-16">
        <div className="font-mono text-xs tracking-[0.16em] uppercase text-lemon mb-5">Ask AI</div>
        {/* Heading on top, chat full width underneath: the conversation gets the whole card. */}
        <div className="rounded-3xl bg-surface border border-white/[0.07] p-6 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3 mb-6">
            <h2 id="ask-title" className="font-display font-bold text-[28px] sm:text-[38px] leading-[1.1] tracking-tight">
              Ask in your own words.
            </h2>
            <p className="text-base leading-relaxed text-muted max-w-[460px]">
              The assistant reads the same Census tables behind every suburb page, and links back
              to the suburbs it used.
            </p>
          </div>
          <AgentChat tall />
        </div>
      </section>

      <div className="max-w-[1240px] mx-auto px-6 sm:px-8 pb-12">
        <Footer />
      </div>
    </main>
  )
}

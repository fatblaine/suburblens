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
import { useMediaQuery, SM_UP } from '../lib/useMediaQuery'

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
  const smUp = useMediaQuery(SM_UP)

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
    // While anything is selected, phones show SearchBox's fixed action bar;
    // pad the page so it never covers the footer.
    <main className={`min-h-screen bg-ink animate-fade-in ${selected.length > 0 ? 'pb-32 sm:pb-0' : ''}`}>
      <PageMeta
        title="SuburbLens: see what a Sydney or Melbourne suburb is actually like"
        description="Compare suburbs using ABS Census data: who owns, who rents, and how that has shifted since 2011, plus community languages, countries of birth, and education levels."
      />

      {/* ── Header ─────────────────────────────────────── */}
      {/* Same 1240px column as the content, so the right-hand controls line up
          with the cards below. The auth badge renders inline here (the global
          fixed one hides itself on "/"). */}
      <header className="border-b border-white/[0.06]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-4 flex items-center gap-4 lg:gap-6">
          <Link to="/" className="flex items-center gap-2.5 font-display font-bold text-lg text-fg">
            <img src="/logo.svg" alt="" className="w-7 h-7" />
            SuburbLens
          </Link>
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className="px-2 lg:px-3 py-2.5 rounded-lg text-sm font-medium text-muted whitespace-nowrap transition-colors hover:text-fg"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {/* Desktop-class browsers only (sm and up): mobile Chrome can't
                install extensions, and the iOS app must not link out to one. */}
            {!isNativeApp && (
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="Check any suburb while you browse listings"
                onClick={() => track('extension_click', { placement: 'home_header' })}
                className="hidden sm:inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2.5 font-mono text-xs text-fg transition-colors hover:border-lemon/60 hover:text-lemon"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
                </svg>
                <span className="hidden lg:inline">Chrome extension</span>
                <span className="lg:hidden">Extension</span>
              </a>
            )}
            <AuthBadge inline />
          </div>
        </div>
      </header>

      {/* ── Level 1 · Search ───────────────────────────── */}
      <section
        aria-label="Search"
        className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-8 sm:pt-14 pb-2 sm:pb-10 flex flex-wrap items-center gap-12 lg:gap-14"
      >
        <div className="flex-[1_1_520px] min-w-0">
          <div className="font-mono text-xs tracking-[0.16em] uppercase text-lemon mb-5">
            Compare multiple suburbs
          </div>
          <h1 className="font-display font-bold text-[36px] sm:text-5xl lg:text-[64px] leading-[1.04] tracking-tight text-fg mb-4">
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
              onClear={() => setSelected([])}
            />
            {/* Most-viewed suburbs, last 30 days. Clicking one adds it to the
                search box above so the user can keep building a comparison. */}
            <PopularSuburbs selected={selected} onSelect={handleAdd} />
          </div>
        </div>

        {/* Phones skip the #1 card and the Most viewed section: the popular
            pills under the search already list the same suburbs. */}
        {smUp && (
          <div className="flex-[1_1_400px] min-w-0">
            <TopSuburbCard />
          </div>
        )}
      </section>

      {/* ── Level 2 · Guide ────────────────────────────── */}
      {smUp && <MostViewedSection selected={selected} onAdd={handleAdd} />}

      {/* Map */}
      <section aria-labelledby="map-title" className="reveal max-w-[1240px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <div className="font-mono text-xs tracking-[0.16em] uppercase text-lemon mb-3 sm:mb-4">Explore the map</div>
        <div
          className="rounded-3xl border border-white/[0.08] overflow-hidden flex flex-wrap"
          style={{ background: 'linear-gradient(135deg, #15323a, #0d0f14)' }}
        >
          <div className="flex-[1_1_380px] min-w-0 p-5 sm:p-12 flex flex-col gap-3 sm:gap-4">
            <h2 id="map-title" className="font-display font-bold text-[24px] sm:text-[40px] leading-[1.12] tracking-tight">
              Watch a city change, one Census at a time.
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Every suburb in Sydney and Melbourne, shaded by how its mix of owners and renters
              shifted from 2011 to 2021. See where renters are moving.
            </p>
            <Link
              to="/map"
              onClick={() => track('home_map_click')}
              className="self-stretch sm:self-start text-center mt-2 sm:mt-3 px-5 py-3.5 rounded-xl border border-white/15 text-fg text-[15px] font-semibold transition-colors hover:border-lemon/60 hover:text-lemon"
            >
              Open the map →
            </Link>
          </div>
          <MapPreview />
        </div>
      </section>

      {/* Ask AI */}
      <section aria-labelledby="ask-title" className="reveal max-w-[1240px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-8 sm:pb-12">
        <div className="font-mono text-xs tracking-[0.16em] uppercase text-lemon mb-3 sm:mb-4">Ask AI</div>
        {/* Heading on top, chat full width underneath: the conversation gets the whole card. */}
        <div className="rounded-3xl bg-surface border border-white/[0.07] p-4 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-2 mb-5 sm:mb-6 px-1 sm:px-0">
            <h2 id="ask-title" className="font-display font-bold text-[26px] sm:text-[38px] leading-[1.12] tracking-tight">
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

      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pb-8 sm:pb-12">
        <Footer />
      </div>
    </main>
  )
}

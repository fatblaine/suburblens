import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchBox from '../components/SearchBox'
import AgentChat from '../components/AgentChat'
import PopularSuburbs from '../components/PopularSuburbs'
import PageMeta from '../components/PageMeta'
import Footer from '../components/Footer'
import FeedbackButton from '../components/FeedbackButton'
import type { SuburbSearchResult } from '../types/api'
import { track } from '../lib/analytics'

const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/suburblens/ipibeapbfhilcffdbaeihcholjjdchej'

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
        title="SuburbLens — see what a Sydney or Melbourne suburb is actually like"
        description="Compare suburbs using ABS Census data: who owns, who rents, and how that has shifted since 2011 — plus community languages, countries of birth, and education levels."
      />
      {/* ── Header ─────────────────────────────────────── */}
      <header className="flex items-center px-6 sm:px-10 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 font-display font-bold text-lg text-white">
          <img src="/logo.svg" alt="" className="w-6 h-6" />
          SuburbLens
        </div>
      </header>

      {/* ── Landing ────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 sm:px-10 pt-16 pb-24">
        <div className="font-mono text-xs tracking-[0.16em] uppercase text-lemon mb-4">
          Compare multiple suburbs
        </div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl leading-[1.04] tracking-tight text-fg mb-6">
          Which suburb are you<br />weighing up?
        </h1>

        <div className="flex flex-wrap items-center gap-3 mb-9">
          <FeedbackButton placement="home_hero" />
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Check any suburb while you browse listings"
            onClick={() => track('extension_click', { placement: 'home_hero' })}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-mono text-xs text-fg transition-colors hover:border-lemon/60 hover:text-lemon"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
            </svg>
            Get Chrome extension
          </a>
        </div>

        <SearchBox
          selected={selected}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onCompare={handleCompare}
          onNearby={handleNearby}
        />

        {/* most-viewed suburbs, last 30 days — renders nothing while empty.
            Clicking one selects it into the search box above, so the user can
            keep adding suburbs before comparing. */}
        <PopularSuburbs selected={selected} onSelect={handleAdd} />

        {/* feature card */}
        <button
          onClick={() => navigate('/map')}
          className="mt-12 w-full text-left rounded-2xl p-6 border border-white/[0.08] overflow-hidden relative transition-transform hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #15323a, #0d0f14)' }}
        >
          <div className="font-display font-semibold text-[17px] text-fg mb-1.5">Browse on the map →</div>
          <div className="text-[13px] text-muted">
            See ownership-to-rental shift across all of Sydney &amp; Melbourne.
          </div>
        </button>

        <div className="mt-8">
          <AgentChat />
        </div>

        <Footer className="mt-8" />
      </div>
    </main>
  )
}

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SearchBox from '../components/SearchBox'
import AgentChat from '../components/AgentChat'
import PopularSuburbs from '../components/PopularSuburbs'
import PageMeta from '../components/PageMeta'
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
        <h1 className="font-display font-bold text-4xl sm:text-5xl leading-[1.04] tracking-tight text-fg mb-9">
          Which suburb are you<br />weighing up?
        </h1>

        <SearchBox
          selected={selected}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onCompare={handleCompare}
          onNearby={handleNearby}
        />

        {/* most-viewed suburbs, last 30 days — renders nothing while empty */}
        <PopularSuburbs />

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

        {/* Chrome extension */}
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('extension_click', { placement: 'card' })}
          className="mt-3 flex items-center gap-3 rounded-xl px-5 py-3.5 bg-surface border border-white/[0.07] transition-colors hover:border-lemon/40 group"
        >
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-lemon shrink-0">
            Chrome
          </span>
          <span className="text-[13px] text-muted flex-1">
            Get the extension — check any suburb while you browse listings.
          </span>
          <span className="text-dim transition-colors group-hover:text-lemon shrink-0">→</span>
        </a>

        <div className="mt-8">
          <AgentChat />
        </div>

        <footer className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-dim">
          <span>Covers Sydney &amp; Melbourne suburbs only.</span>
          <span aria-hidden="true" className="text-white/15">·</span>
          <a
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('extension_click', { placement: 'footer' })}
            className="transition-colors hover:text-lemon"
          >
            Chrome extension
          </a>
          <span aria-hidden="true" className="text-white/15">·</span>
          <Link to="/privacy" className="transition-colors hover:text-lemon">
            Privacy
          </Link>
        </footer>
      </div>
    </main>
  )
}

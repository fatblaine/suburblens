import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSuburbTenure, useSuburbLanguage, useSuburbBirthCountry, useSuburbEducation, useSuburbHousingMix, useSuburbCrime, useSuburbDensity } from '../api/suburbs'
import ShiftIndexCard from './ShiftIndexCard'
import TenureChart from './TenureChart'
import LanguageChart from './LanguageChart'
import BirthCountryChart from './BirthCountryChart'
import EducationChart from './EducationChart'
import HousingMix from './HousingMix'
import CrimeChart from './CrimeChart'
import LoadingSkeleton from './LoadingSkeleton'
import BarListSkeleton from './BarListSkeleton'
import NearbySuburbs from './NearbySuburbs'
import DistancePanel from './DistancePanel'
import AmenitiesPanel from './AmenitiesPanel'
import SuburbNarrative from './SuburbNarrative'
import TabStrip from './TabStrip'
import TabDeck from './TabDeck'

interface Props {
  salCode: string
  onAdd: (salCode: string) => void
  onRemove: () => void
  defaultNearbyExpanded?: boolean
  /** Mirror the active tab into `?tab=` — only the card the URL points at. */
  syncUrl?: boolean
}

type CommunityTab = 'language' | 'birthcountry'

// Compact, always-open section panel used inside a tab (no accordion — the tab
// strip already gates what is visible).
const PANEL = 'bg-surface border border-white/[0.07] shadow-xl shadow-black/30 rounded-2xl p-5'

// A data block inside a tab. Click the header to expand/collapse; open by
// default so switching to a tab shows its content straight away.
function Panel({
  title,
  subtitle,
  note,
  defaultOpen = true,
  children,
}: {
  title: string
  subtitle?: string
  note?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={PANEL}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <h3 className="font-display text-base font-semibold text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>}
        </div>
        <span
          className={`mt-1 shrink-0 text-xs text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {open && (
        <>
          <div className="mt-4">{children}</div>
          {note && <p className="mt-4 text-xs leading-5 text-white/40">&#9432; {note}</p>}
        </>
      )}
    </section>
  )
}

function HousingMixSection({ salCode }: { salCode: string }) {
  const { data, isPending, isError } = useSuburbHousingMix(salCode)

  if (isError) return null

  if (isPending) return (
    <div className={PANEL}>
      <BarListSkeleton rows={3} labelWidth="w-36" />
    </div>
  )

  if (!data) return null

  return (
    <Panel
      title="Unit-to-House Ratio"
      subtitle="Attached dwellings vs separate houses · 2021 Census"
      note={data.dataNote}
    >
      <HousingMix response={data} />
    </Panel>
  )
}

function CommunitySection({ salCode }: { salCode: string }) {
  const [tab, setTab] = useState<CommunityTab>('language')
  const lang = useSuburbLanguage(salCode)
  const birth = useSuburbBirthCountry(salCode)

  if (lang.isPending) return (
    <div className={PANEL}>
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-white/10 rounded w-1/3" />
        <div className="h-3 bg-white/10 rounded w-1/4" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-32 h-3 bg-white/10 rounded" />
              <div className="flex-1 h-4 bg-white/10 rounded-full" />
              <div className="w-10 h-3 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (!lang.data && !birth.data) return null

  const dataNote = tab === 'language' ? lang.data?.dataNote : birth.data?.dataNote

  return (
    <Panel title="Community Profile" subtitle="Language & origins · 2011 / 2016 / 2021" note={dataNote}>
      <div className="flex gap-1 bg-surface-2 border border-white/10 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setTab('language')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === 'language' ? 'bg-lemon text-ink' : 'text-muted hover:text-fg'
          }`}
        >
          Language at Home
        </button>
        <button
          onClick={() => setTab('birthcountry')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === 'birthcountry' ? 'bg-lemon text-ink' : 'text-muted hover:text-fg'
          }`}
        >
          Country of Birth
        </button>
      </div>

      {tab === 'language' && lang.data && <LanguageChart response={lang.data} />}
      {tab === 'birthcountry' && birth.data && <BirthCountryChart response={birth.data} />}
    </Panel>
  )
}

function EducationSection({ salCode }: { salCode: string }) {
  const { data, isPending } = useSuburbEducation(salCode)

  if (isPending) return (
    <div className={PANEL}>
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-36 h-3 bg-white/10 rounded" />
            <div className="flex-1 h-4 bg-white/10 rounded-full" />
            <div className="w-10 h-3 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  )

  if (!data) return null

  return (
    <Panel title="Education Level" subtitle="Highest qualification · 2011 / 2016 / 2021" note={data.dataNote}>
      <EducationChart response={data} />
    </Panel>
  )
}

function CrimeSection({ salCode }: { salCode: string }) {
  const { data, isPending, isError } = useSuburbCrime(salCode)

  // 404 (non-Melbourne / no data) → silently render nothing
  if (isError) return null

  if (isPending) return (
    <div className={PANEL}>
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 h-3 bg-white/10 rounded" />
            <div className="flex-1 h-4 bg-white/10 rounded-full" />
            <div className="w-10 h-3 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  )

  if (!data) return null

  return (
    <Panel
      title="Crime"
      subtitle="Recorded incidents · year ending March · Greater Melbourne"
      note={data.dataNote}
    >
      <CrimeChart response={data} />
    </Panel>
  )
}

// Population density stat tile — a single scalar, so it reads as a headline
// number + a within-city percentile, not a chart. 404 (no data) → renders
// nothing so the Overview tab just skips it.
function densityTier(pct: number): { label: string; className: string } {
  if (pct >= 0.8) return { label: 'High density', className: 'bg-lemon/15 text-lemon' }
  if (pct >= 0.4) return { label: 'Moderate density', className: 'bg-surface-3 text-muted' }
  return { label: 'Low density', className: 'bg-surface-3 text-faint' }
}

function DensitySection({ salCode }: { salCode: string }) {
  const { data, isPending, isError } = useSuburbDensity(salCode)

  if (isError) return null

  if (isPending) return (
    <div className={PANEL}>
      <div className="animate-pulse space-y-2">
        <div className="h-3 w-1/3 rounded bg-white/10" />
        <div className="h-7 w-1/2 rounded bg-white/10" />
        <div className="h-3 w-2/5 rounded bg-white/10" />
      </div>
    </div>
  )

  if (!data || data.personsPerSqkm == null) return null

  const city = data.gccsaName ?? ''
  const density = Math.round(data.personsPerSqkm)
  const bench = data.benchmark
  const tier = bench ? densityTier(bench.percentileRank) : null

  return (
    <div className={PANEL}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
          Population density · {data.censusYear}
        </p>
        {tier && (
          <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tier.className}`}>
            {tier.label}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-bold tracking-tight text-fg">
          {density.toLocaleString()}
        </span>
        <span className="font-mono text-sm text-muted">/km²</span>
      </div>

      {bench && (
        <p className="mt-2 text-sm text-muted">
          Denser than <span className="text-fg">{Math.round(bench.percentileRank * 100)}%</span> of {city} suburbs
          {bench.medianDensity != null && (
            <span className="text-faint"> · city median {Math.round(bench.medianDensity).toLocaleString()}/km²</span>
          )}
        </p>
      )}

      <p className="mt-1 font-mono text-[11px] text-dim">
        {data.totalPersons?.toLocaleString()} residents · gross density (incl. parks &amp; water)
      </p>
    </div>
  )
}

const BASE_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'housing', label: 'Housing' },
  { key: 'distances', label: 'Local Area' },
  { key: 'community', label: 'Community' },
  { key: 'education', label: 'Education' },
]

export default function SuburbCard({ salCode, onAdd, onRemove, defaultNearbyExpanded = false, syncUrl = false }: Props) {
  const { data, isPending, isError } = useSuburbTenure(salCode)
  const [searchParams, setSearchParams] = useSearchParams()
  // Stacked cards keep their tab locally; only the URL suburb writes to `?tab=`.
  const [localKey, setLocalKey] = useState('overview')

  if (isPending) {
    return (
      <div className={PANEL}>
        <LoadingSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className={`${PANEL} text-white/40 text-sm`}>
        Failed to load data for {salCode}.
      </div>
    )
  }

  // Crime data only exists for Greater Melbourne — surface a 6th tab there only.
  const isMelbourne = data.gccsaName?.toLowerCase().includes('melbourne')
  const tabs = isMelbourne ? [...BASE_TABS, { key: 'crime', label: 'Crime' }] : BASE_TABS

  // Address tabs by key, not index: Melbourne has a 6th tab, so index 4 would
  // mean different things in different cities. An unknown key falls back to 0.
  const wantedKey = syncUrl ? (searchParams.get('tab') ?? 'overview') : localKey
  const active = Math.max(0, tabs.findIndex(t => t.key === wantedKey))
  const activeKey = tabs[active].key
  const prevIdx = (active - 1 + tabs.length) % tabs.length
  const nextIdx = (active + 1) % tabs.length

  const selectTab = (i: number) => {
    const key = tabs[i].key
    if (!syncUrl) return setLocalKey(key)
    const next = new URLSearchParams(searchParams)
    if (key === 'overview') next.delete('tab')  // default stays out of the URL
    else next.set('tab', key)
    setSearchParams(next, { replace: true })    // tab clicks don't pile up history
  }
  const showNote = activeKey === 'overview' || activeKey === 'housing'

  // Every panel is rendered, not just the active one: the peek needs its
  // neighbours on screen, and windowing would remount them — losing each
  // Panel's open/closed state and the Community sub-tab, and re-running the
  // chart animations on every swipe. The cost is 3 extra requests per card
  // (housing-mix, distances, amenities); the other six are already fired by the
  // Overview tab and deduped by TanStack on ['suburb-<path>', salCode].
  const renderPanel = (key: string) => {
    switch (key) {
      case 'overview':
        return (
          <>
            <DensitySection salCode={salCode} />
            <SuburbNarrative salCode={salCode} />
            <NearbySuburbs salCode={salCode} defaultExpanded={defaultNearbyExpanded} onSelect={onAdd} />
          </>
        )
      case 'housing':
        return (
          <>
            <ShiftIndexCard
              residencyShiftIndex={data.residencyShiftIndex}
              trendLabel={data.trendLabel}
            />
            <Panel
              title="Tenure Time Machine"
              subtitle="% of occupied dwellings · 2011 / 2016 / 2021"
              note={<>Cross-year data is sourced from ABS SA2 area: <strong>{data.sa2Name}</strong>. This may include neighbouring localities.</>}
            >
              <TenureChart tenure={data.tenure} />
            </Panel>
            <HousingMixSection salCode={salCode} />
          </>
        )
      case 'distances':
        return (
          <>
            <DistancePanel salCode={salCode} />
            <AmenitiesPanel salCode={salCode} />
          </>
        )
      case 'community':
        return <CommunitySection salCode={salCode} />
      case 'education':
        return <EducationSection salCode={salCode} />
      case 'crime':
        return <CrimeSection salCode={salCode} />
      default:
        return null
    }
  }


  return (
    <div className="flex flex-col gap-3.5">

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-fg">{data.salName}</h2>
          <p className="mt-0.5 text-sm text-muted">{data.stateName} · {data.gccsaName}</p>
        </div>
        <button
          onClick={onRemove}
          className="ml-4 text-white/30 hover:text-white/70 text-xl leading-none mt-1"
          title="Remove"
        >
          ×
        </button>
      </div>

      <TabStrip tabs={tabs} active={active} onSelect={selectTab} idPrefix={salCode} />

      <TabDeck
        tabs={tabs}
        active={active}
        onSelect={selectTab}
        idPrefix={salCode}
        renderPanel={renderPanel}
      />

      {/* The reader finishes a panel by scrolling to its bottom, which on a phone
          is exactly where "and then?" gets asked — so both moves and the position
          live in one thumb-reachable block there. Forward is the primary half;
          back is deliberately quieter. */}
      <nav
        aria-label="Section navigation"
        className="mt-0.5 flex items-stretch overflow-hidden rounded-2xl border border-white/10 bg-surface-2"
      >
        <button
          type="button"
          onClick={() => selectTab(prevIdx)}
          className="group flex min-w-0 shrink items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-3"
        >
          <span
            aria-hidden="true"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-sm leading-none text-dim transition-colors group-hover:border-white/25 group-hover:text-muted"
          >
            ‹
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-dim">Previous</span>
            <span className="mt-0.5 block truncate font-display text-sm font-medium text-muted transition-colors group-hover:text-fg">
              {tabs[prevIdx].label}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center justify-center border-x border-white/[0.08] px-3">
          <span className="font-mono text-[10px] text-dim">{active + 1} / {tabs.length}</span>
        </div>

        <button
          type="button"
          onClick={() => selectTab(nextIdx)}
          className="group flex min-w-0 flex-1 items-center justify-end gap-3 px-4 py-3.5 text-right transition-colors hover:bg-surface-3"
        >
          <span className="min-w-0">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-faint">
              {active === tabs.length - 1 ? 'Back to the start' : 'Next section'}
            </span>
            <span className="mt-0.5 block truncate font-display text-lg font-semibold text-fg">
              {tabs[nextIdx].label}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-surface-3 text-lg leading-none text-muted transition-colors group-hover:border-lemon/50 group-hover:text-lemon"
          >
            ›
          </span>
        </button>
      </nav>

      {showNote && (
        <div className="bg-white/[0.06] border border-amber-300/30 rounded-xl p-3.5 text-xs leading-5 text-amber-200">
          <strong className="font-semibold">Note:</strong> The Residency Shift Index is a SuburbLens custom heuristic based on
          2016&rarr;2021 tenure changes. It does not represent an official ABS metric.
        </div>
      )}

    </div>
  )
}

import { useState } from 'react'
import { useSuburbTenure, useSuburbLanguage, useSuburbBirthCountry, useSuburbEducation, useSuburbCrime } from '../api/suburbs'
import ShiftIndexCard from './ShiftIndexCard'
import TenureChart from './TenureChart'
import LanguageChart from './LanguageChart'
import BirthCountryChart from './BirthCountryChart'
import EducationChart from './EducationChart'
import CrimeChart from './CrimeChart'
import LoadingSkeleton from './LoadingSkeleton'
import NearbySuburbs from './NearbySuburbs'

interface Props {
  salCode: string
  onAdd: (salCode: string) => void
  onRemove: () => void
  defaultNearbyExpanded?: boolean
}

type CommunityTab = 'language' | 'birthcountry'

const GLASS_CARD = 'bg-surface border border-white/[0.07] shadow-xl shadow-black/30 rounded-2xl'

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={GLASS_CARD}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-white/40 transition-transform duration-200 ml-4 shrink-0 ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  )
}

function CommunitySection({ salCode }: { salCode: string }) {
  const [tab, setTab] = useState<CommunityTab>('language')
  const lang = useSuburbLanguage(salCode)
  const birth = useSuburbBirthCountry(salCode)

  if (lang.isPending) return (
    <div className={GLASS_CARD + ' p-6'}>
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
    <CollapsibleSection
      title="Community Profile"
      subtitle="Language & origins · 2011 / 2016 / 2021"
    >
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

      {dataNote && <p className="mt-5 text-xs text-white/40">&#9432; {dataNote}</p>}
    </CollapsibleSection>
  )
}

function EducationSection({ salCode }: { salCode: string }) {
  const { data, isPending } = useSuburbEducation(salCode)

  if (isPending) return (
    <div className={GLASS_CARD + ' p-6'}>
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
    <CollapsibleSection
      title="Education Level"
      subtitle="Highest qualification · 2011 / 2016 / 2021"
    >
      <EducationChart response={data} />
      <p className="mt-5 text-xs text-white/40">&#9432; {data.dataNote}</p>
    </CollapsibleSection>
  )
}

function CrimeSection({ salCode }: { salCode: string }) {
  const { data, isPending, isError } = useSuburbCrime(salCode)

  // 404 (non-Melbourne / no data) → silently render nothing
  if (isError) return null

  if (isPending) return (
    <div className={GLASS_CARD + ' p-6'}>
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
    <CollapsibleSection
      title="Crime"
      subtitle="Recorded incidents · year ending March · Greater Melbourne"
    >
      <CrimeChart response={data} />
      <p className="mt-5 text-xs text-white/40">&#9432; {data.dataNote}</p>
    </CollapsibleSection>
  )
}

export default function SuburbCard({ salCode, onAdd, onRemove, defaultNearbyExpanded = false }: Props) {
  const { data, isPending, isError } = useSuburbTenure(salCode)

  if (isPending) {
    return (
      <div className={GLASS_CARD + ' p-6'}>
        <LoadingSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className={`${GLASS_CARD} p-6 text-white/40 text-sm`}>
        Failed to load data for {salCode}.
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-fg">{data.salName}</h2>
          <p className="text-muted mt-1">{data.stateName} · {data.gccsaName}</p>
        </div>
        <button
          onClick={onRemove}
          className="ml-4 text-white/30 hover:text-white/70 text-xl leading-none mt-1"
          title="Remove"
        >
          ×
        </button>
      </div>

      <ShiftIndexCard
        residencyShiftIndex={data.residencyShiftIndex}
        trendLabel={data.trendLabel}
      />

      <NearbySuburbs
        salCode={salCode}
        defaultExpanded={defaultNearbyExpanded}
        onSelect={onAdd}
      />

      <CollapsibleSection
        title="Tenure Time Machine"
        subtitle="% of occupied dwellings · 2011 / 2016 / 2021"
      >
        <TenureChart tenure={data.tenure} />
        <p className="mt-4 text-xs text-white/40">
          &#9432; Cross-year data is sourced from ABS SA2 area: <strong>{data.sa2Name}</strong>.
          This may include neighbouring localities.
        </p>
      </CollapsibleSection>

      <CommunitySection salCode={salCode} />

      <EducationSection salCode={salCode} />

      <CrimeSection salCode={salCode} />

      <div className="bg-white/10 border border-amber-300/30 rounded-xl p-4 text-sm text-amber-200">
        <strong>Note:</strong> The Residency Shift Index is a SuburbLens custom heuristic based on
        2016&rarr;2021 tenure changes. It does not represent an official ABS metric.
      </div>

    </div>
  )
}

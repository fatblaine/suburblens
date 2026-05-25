import { useState } from 'react'
import { useSuburbTenure, useSuburbLanguage, useSuburbBirthCountry } from '../api/suburbs'
import ShiftIndexCard from './ShiftIndexCard'
import TenureChart from './TenureChart'
import LanguageChart from './LanguageChart'
import BirthCountryChart from './BirthCountryChart'
import LoadingSkeleton from './LoadingSkeleton'
import NearbySuburbs from './NearbySuburbs'

interface Props {
  salCode: string
  onAdd: (salCode: string) => void
  onRemove: () => void
  defaultNearbyExpanded?: boolean
}

type CommunityTab = 'language' | 'birthcountry'

const GLASS_CARD = 'bg-white/10 backdrop-blur-md border border-white/15 shadow-xl shadow-black/20 rounded-2xl p-6'

function CommunitySection({ salCode }: { salCode: string }) {
  const [tab, setTab] = useState<CommunityTab>('language')
  const lang = useSuburbLanguage(salCode)
  const birth = useSuburbBirthCountry(salCode)

  if (lang.isPending) return (
    <div className={GLASS_CARD}>
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
    <div className={GLASS_CARD}>
      <h3 className="text-lg font-semibold text-white mb-1">Community Profile</h3>
      <p className="text-sm text-white/50 mb-5">Language & origins · 2011 / 2016 / 2021</p>

      <div className="flex gap-1 bg-white/10 border border-white/10 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setTab('language')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === 'language' ? 'bg-white/25 shadow-sm text-white' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Language at Home
        </button>
        <button
          onClick={() => setTab('birthcountry')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            tab === 'birthcountry' ? 'bg-white/25 shadow-sm text-white' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Country of Birth
        </button>
      </div>

      {tab === 'language' && lang.data && <LanguageChart response={lang.data} />}
      {tab === 'birthcountry' && birth.data && <BirthCountryChart response={birth.data} />}

      {dataNote && <p className="mt-5 text-xs text-white/40">&#9432; {dataNote}</p>}
    </div>
  )
}

export default function SuburbCard({ salCode, onAdd, onRemove, defaultNearbyExpanded = false }: Props) {
  const { data, isPending, isError } = useSuburbTenure(salCode)

  if (isPending) {
    return (
      <div className={GLASS_CARD}>
        <LoadingSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className={`${GLASS_CARD} text-white/40 text-sm`}>
        Failed to load data for {salCode}.
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{data.salName}</h2>
          <p className="text-white/60 mt-1">{data.stateName} · {data.gccsaName}</p>
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

      <div className={GLASS_CARD}>
        <h3 className="text-lg font-semibold text-white mb-1">Tenure Time Machine</h3>
        <p className="text-sm text-white/50 mb-6">
          Tenure composition across 2011 / 2016 / 2021 (% of occupied dwellings)
        </p>
        <TenureChart tenure={data.tenure} />
        <p className="mt-4 text-xs text-white/40">
          &#9432; Cross-year data is sourced from ABS SA2 area: <strong>{data.sa2Name}</strong>.
          This may include neighbouring localities.
        </p>
      </div>

      <CommunitySection salCode={salCode} />

      <div className="bg-white/10 border border-amber-300/30 rounded-xl p-4 text-sm text-amber-200">
        <strong>Note:</strong> The Residency Shift Index is a SuburbLens custom heuristic based on
        2016&rarr;2021 tenure changes. It does not represent an official ABS metric.
      </div>

    </div>
  )
}

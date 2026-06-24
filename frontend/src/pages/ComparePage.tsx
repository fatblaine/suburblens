import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSuburbTenureBatch, useSuburbLanguage, useSuburbBirthCountry, useSuburbEducation } from '../api/suburbs'
import ShiftIndexCard from '../components/ShiftIndexCard'
import TenureChart from '../components/TenureChart'
import LanguageChart from '../components/LanguageChart'
import BirthCountryChart from '../components/BirthCountryChart'
import EducationChart from '../components/EducationChart'
import LoadingSkeleton from '../components/LoadingSkeleton'

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
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>
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

function CommunitySection({ salCode }: { salCode: string }) {
  const [tab, setTab] = useState<CommunityTab>('language')
  const lang = useSuburbLanguage(salCode)
  const birth = useSuburbBirthCountry(salCode)

  if (lang.isPending) return (
    <div className={GLASS_CARD + ' p-6'}>
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 h-3 bg-white/10 rounded" />
            <div className="flex-1 h-4 bg-white/10 rounded-full" />
            <div className="w-10 h-3 bg-white/10 rounded" />
          </div>
        ))}
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
      <div className="flex gap-1 bg-surface-2 border border-white/10 rounded-lg p-1 w-fit mb-5">
        <button
          onClick={() => setTab('language')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            tab === 'language' ? 'bg-lemon text-ink' : 'text-muted hover:text-fg'
          }`}
        >
          Language at Home
        </button>
        <button
          onClick={() => setTab('birthcountry')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            tab === 'birthcountry' ? 'bg-lemon text-ink' : 'text-muted hover:text-fg'
          }`}
        >
          Country of Birth
        </button>
      </div>

      {tab === 'language' && lang.data && <LanguageChart response={lang.data} />}
      {tab === 'birthcountry' && birth.data && <BirthCountryChart response={birth.data} />}

      {dataNote && <p className="mt-4 text-xs text-white/40">&#9432; {dataNote}</p>}
    </CollapsibleSection>
  )
}

export default function ComparePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const salCodes = searchParams.getAll('codes')

  const { data, isPending, isError } = useSuburbTenureBatch(salCodes)

  if (salCodes.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center px-4">
        <p className="text-white/60 mb-4">No suburbs selected for comparison.</p>
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white/80 underline text-sm">
          ← Search again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-4 py-10">

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-white/50 hover:text-white/80 text-sm transition-colors mb-8"
        >
          ← Search again
        </button>

        <h1 className="font-display text-3xl font-bold tracking-tight text-fg mb-8">Suburb Comparison</h1>

        {isPending && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {salCodes.map(code => (
              <div key={code} className={GLASS_CARD + ' p-6'}>
                <LoadingSkeleton />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-400">Failed to load comparison data. Please try again.</p>
        )}

        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.map(suburb => (
              <div key={suburb.salCode} className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-fg">{suburb.salName}</h2>
                  <p className="text-muted text-sm">{suburb.stateName} · {suburb.gccsaName}</p>
                </div>

                <ShiftIndexCard
                  residencyShiftIndex={suburb.residencyShiftIndex}
                  trendLabel={suburb.trendLabel}
                />

                <CollapsibleSection
                  title="Tenure Time Machine"
                  subtitle="% of occupied dwellings · 2011 / 2016 / 2021"
                >
                  <TenureChart tenure={suburb.tenure} />
                  <p className="mt-3 text-xs text-white/40">
                    &#9432; Data sourced from ABS SA2: <strong>{suburb.sa2Name}</strong>
                  </p>
                </CollapsibleSection>

                <CommunitySection salCode={suburb.salCode} />

                <EducationSection salCode={suburb.salCode} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-white/10 border border-amber-300/30 rounded-xl p-4 text-sm text-amber-200">
          <strong>Note:</strong> The Residency Shift Index is a SuburbLens custom heuristic based on
          2016&rarr;2021 tenure changes. It does not represent an official ABS metric.
        </div>

      </div>
    </div>
  )
}

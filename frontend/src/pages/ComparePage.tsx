import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSuburbTenureBatch, useSuburbLanguage, useSuburbBirthCountry } from '../api/suburbs'
import ShiftIndexCard from '../components/ShiftIndexCard'
import TenureChart from '../components/TenureChart'
import LanguageChart from '../components/LanguageChart'
import BirthCountryChart from '../components/BirthCountryChart'
import LoadingSkeleton from '../components/LoadingSkeleton'

type CommunityTab = 'language' | 'birthcountry'

function CommunitySection({ salCode }: { salCode: string }) {
  const [tab, setTab] = useState<CommunityTab>('language')
  const lang = useSuburbLanguage(salCode)
  const birth = useSuburbBirthCountry(salCode)

  if (lang.isPending) return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 h-3 bg-gray-200 rounded" />
            <div className="flex-1 h-4 bg-gray-200 rounded-full" />
            <div className="w-10 h-3 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )

  if (!lang.data && !birth.data) return null

  const dataNote = tab === 'language' ? lang.data?.dataNote : birth.data?.dataNote

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900 mb-1">Community Profile</h3>
      <p className="text-xs text-gray-400 mb-4">Language & origins · 2011 / 2016 / 2021</p>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-5">
        <button
          onClick={() => setTab('language')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            tab === 'language' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Language at Home
        </button>
        <button
          onClick={() => setTab('birthcountry')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            tab === 'birthcountry' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Country of Birth
        </button>
      </div>

      {tab === 'language' && lang.data && <LanguageChart response={lang.data} />}
      {tab === 'birthcountry' && birth.data && <BirthCountryChart response={birth.data} />}

      {dataNote && <p className="mt-4 text-xs text-gray-400">&#9432; {dataNote}</p>}
    </div>
  )
}

export default function ComparePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const salCodes = searchParams.getAll('codes')

  const { data, isPending, isError } = useSuburbTenureBatch(salCodes)

  if (salCodes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <p className="text-gray-500 mb-4">No suburbs selected for comparison.</p>
        <button onClick={() => navigate('/')} className="text-blue-500 hover:underline text-sm">
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

        <h1 className="text-2xl font-bold text-white mb-8">Suburb Comparison</h1>

        {isPending && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {salCodes.map(code => (
              <div key={code} className="bg-white rounded-2xl p-6 shadow-sm">
                <LoadingSkeleton />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-500">Failed to load comparison data. Please try again.</p>
        )}

        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.map(suburb => (
              <div key={suburb.salCode} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{suburb.salName}</h2>
                  <p className="text-white/60 text-sm">{suburb.stateName} · {suburb.gccsaName}</p>
                </div>

                <ShiftIndexCard
                  residencyShiftIndex={suburb.residencyShiftIndex}
                  trendLabel={suburb.trendLabel}
                />

                <div className="bg-white/10 backdrop-blur-md border border-white/15 shadow-xl shadow-black/20 rounded-2xl p-6">
                  <h3 className="text-base font-semibold text-white mb-1">Tenure Time Machine</h3>
                  <p className="text-xs text-white/50 mb-4">
                    % of occupied dwellings · 2011 / 2016 / 2021
                  </p>
                  <TenureChart tenure={suburb.tenure} />
                  <p className="mt-3 text-xs text-white/40">
                    &#9432; Data sourced from ABS SA2: <strong>{suburb.sa2Name}</strong>
                  </p>
                </div>

                <CommunitySection salCode={suburb.salCode} />
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

import { useParams, useNavigate } from 'react-router-dom'
import { useSuburbTenure } from '../api/suburbs'
import ShiftIndexCard from '../components/ShiftIndexCard'
import TenureChart from '../components/TenureChart'
import LoadingSkeleton from '../components/LoadingSkeleton'

export default function SuburbDetailPage() {
  const { salCode } = useParams<{ salCode: string }>()
  const navigate = useNavigate()

  const { data, isPending, isError } = useSuburbTenure(salCode)

  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <LoadingSkeleton />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <p className="text-gray-500 text-lg mb-4">No data found for this suburb.</p>
        <button
          onClick={() => navigate(-1)}
          className="text-blue-500 hover:underline text-sm"
        >
          ← Go back
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm transition-colors"
        >
          ← Search again
        </button>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">{data.salName}</h1>
          <p className="text-gray-500 mt-1">{data.stateName} · {data.gccsaName}</p>
        </div>

        <ShiftIndexCard
          residencyShiftIndex={data.residencyShiftIndex}
          trendLabel={data.trendLabel}
        />

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Tenure Time Machine</h2>
          <p className="text-sm text-gray-400 mb-6">
            Tenure composition across 2011 / 2016 / 2021 (% of occupied dwellings)
          </p>
          <TenureChart tenure={data.tenure} />
          <p className="mt-4 text-xs text-gray-400">
            &#9432; Cross-year data is sourced from ABS SA2 area: <strong>{data.sa2Name}</strong>.
            This may include neighbouring localities.
          </p>
        </div>

        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-700">
          <strong>Note:</strong> The Residency Shift Index is a SuburbLens custom heuristic based on
          2016&rarr;2021 tenure changes. It does not represent an official ABS metric.
        </div>

      </div>
    </div>
  )
}

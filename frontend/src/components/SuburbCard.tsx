import { useSuburbTenure } from '../api/suburbs'
import ShiftIndexCard from './ShiftIndexCard'
import TenureChart from './TenureChart'
import LoadingSkeleton from './LoadingSkeleton'
import NearbySuburbs from './NearbySuburbs'

interface Props {
  salCode: string
  onAdd: (salCode: string) => void      // 点击 nearby suburb 时追加到页面
  onRemove: () => void                   // 关闭这张卡片
  defaultNearbyExpanded?: boolean
}

export default function SuburbCard({ salCode, onAdd, onRemove, defaultNearbyExpanded = false }: Props) {
  const { data, isPending, isError } = useSuburbTenure(salCode)

  if (isPending) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <LoadingSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm text-gray-400 text-sm">
        Failed to load data for {salCode}.
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* 卡片头：suburb 名 + 关闭按钮 */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{data.salName}</h2>
          <p className="text-gray-500 mt-1">{data.stateName} · {data.gccsaName}</p>
        </div>
        <button
          onClick={onRemove}
          className="ml-4 text-gray-300 hover:text-gray-500 text-xl leading-none mt-1"
          title="Remove"
        >
          ×
        </button>
      </div>

      <ShiftIndexCard
        residencyShiftIndex={data.residencyShiftIndex}
        trendLabel={data.trendLabel}
      />

      {/* onSelect 追加新 suburb，不替换 */}
      <NearbySuburbs
        salCode={salCode}
        defaultExpanded={defaultNearbyExpanded}
        onSelect={onAdd}
      />

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Tenure Time Machine</h3>
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
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchBox from '../components/SearchBox'
import type { SuburbSearchResult } from '../types/api'

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
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">

      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">SuburbLens</h1>
        <p className="text-gray-500 text-lg">
          Is this suburb becoming more "owner-occupied" or "rental"?
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Based on Australian Census data from 2011, 2016, and 2021.
        </p>
      </div>

      <SearchBox
        selected={selected}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onCompare={handleCompare}
        onNearby={handleNearby}
      />

      <p className="mt-6 text-xs text-gray-400">
        Only Sydney and Melbourne suburbs are available in this demo version.
      </p>

    </main>
  )
}

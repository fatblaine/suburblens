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
    <main className="min-h-screen flex flex-col items-center justify-center bg-transparent px-4">

      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-white mb-3">SuburbLens</h1>
        <p className="text-white/60 text-lg">
          Explore how Australian suburbs are changing over time.
        </p>
        <p className="text-white/40 text-sm mt-1">
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

      <p className="mt-6 text-xs text-white/40">
        Only Sydney and Melbourne suburbs are available in this demo version.
      </p>

    </main>
  )
}

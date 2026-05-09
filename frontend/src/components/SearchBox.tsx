import { useState, useEffect, useRef } from 'react'
import { useSuburbSearch } from '../api/suburbs'
import type { SuburbSearchResult } from '../types/api'

interface Props {
  selected: SuburbSearchResult[]
  onAdd: (suburb: SuburbSearchResult) => void
  onRemove: (salCode: string) => void
  onCompare: () => void
  onNearby: () => void  // 查看周边，只在选了 1 个 suburb 时触发
}

export default function SearchBox({ selected, onAdd, onRemove, onCompare, onNearby }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: results, isPending } = useSuburbSearch(debouncedQuery)

  function handleSelect(suburb: SuburbSearchResult) {
    onAdd(suburb)
    setQuery('')
    setOpen(false)
  }

  const selectedCodes = new Set(selected.map(s => s.salCode))
  const showDropdown = open && debouncedQuery.trim().length >= 2

  return (
    <div ref={wrapperRef} className="relative w-full max-w-lg">
      <input
        type="text"
        value={query}
        placeholder="Search a suburb, e.g. Glebe..."
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
      />

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
          {isPending && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
          )}

          {!isPending && results?.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">No suburbs found.</div>
          )}

          {results?.map((suburb) => {
            const alreadyAdded = selectedCodes.has(suburb.salCode)
            return (
              <button
                key={suburb.salCode}
                onClick={() => handleSelect(suburb)}
                disabled={alreadyAdded}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="font-medium text-gray-900">{suburb.salName}</span>
                <span className="ml-2 text-sm text-gray-400">
                  {suburb.stateName} · {suburb.gccsaName}
                </span>
                {alreadyAdded && (
                  <span className="ml-2 text-xs text-blue-400">Added</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map(suburb => (
            <span
              key={suburb.salCode}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
            >
              {suburb.salName}
              <button
                onClick={() => onRemove(suburb.salCode)}
                className="ml-1 text-blue-400 hover:text-blue-700 font-bold leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <button
          onClick={onCompare}
          className="mt-3 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
        >
          Compare {selected.length} suburb{selected.length > 1 ? 's' : ''}
        </button>
      )}

      {/* 只选了 1 个 suburb 时才显示"查看周边"，Compare 需要至少 2 个没有意义 */}
      {selected.length === 1 && (
        <button
          onClick={onNearby}
          className="mt-2 w-full py-3 bg-white border border-gray-200 hover:border-blue-400 text-gray-700 font-semibold rounded-xl transition-colors"
        >
          Nearby Suburbs of {selected[0].salName}
        </button>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useSuburbSearch } from '../api/suburbs'
import type { SuburbSearchResult } from '../types/api'

interface Props {
  selected: SuburbSearchResult[]
  onAdd: (suburb: SuburbSearchResult) => void
  onRemove: (salCode: string) => void
  onCompare: () => void
  onNearby: () => void
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
        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 backdrop-blur-sm text-base"
      />

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900/90 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl z-10 overflow-hidden">
          {isPending && (
            <div className="px-4 py-3 text-sm text-white/40">Searching...</div>
          )}

          {!isPending && results?.length === 0 && (
            <div className="px-4 py-3 text-sm text-white/40">No suburbs found.</div>
          )}

          {results?.map((suburb) => {
            const alreadyAdded = selectedCodes.has(suburb.salCode)
            return (
              <button
                key={suburb.salCode}
                onClick={() => handleSelect(suburb)}
                disabled={alreadyAdded}
                className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/10 last:border-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="font-medium text-white/90">{suburb.salName}</span>
                <span className="ml-2 text-sm text-white/40">
                  {suburb.stateName} · {suburb.gccsaName}
                </span>
                {alreadyAdded && (
                  <span className="ml-2 text-xs text-purple-300">Added</span>
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
              className="inline-flex items-center gap-1 px-3 py-1 bg-white/15 border border-white/20 text-white rounded-full text-sm font-medium"
            >
              {suburb.salName}
              <button
                onClick={() => onRemove(suburb.salCode)}
                className="ml-1 text-white/40 hover:text-white font-bold leading-none"
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
          className="mt-3 w-full py-3 bg-white/20 hover:bg-white/30 border border-white/20 text-white font-semibold rounded-xl transition-colors backdrop-blur-sm"
        >
          Compare {selected.length} suburb{selected.length > 1 ? 's' : ''}
        </button>
      )}

      {selected.length === 1 && (
        <button
          onClick={onNearby}
          className="mt-2 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 font-semibold rounded-xl transition-colors backdrop-blur-sm"
        >
          Nearby Suburbs of {selected[0].salName}
        </button>
      )}
    </div>
  )
}

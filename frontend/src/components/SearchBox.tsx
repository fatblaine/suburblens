import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSuburbSearch } from '../api/suburbs'
import type { SuburbSearchResult } from '../types/api'

export default function SearchBox() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)

  const navigate = useNavigate()
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Delay the actual API query by 300ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Close the dropdown when the user clicks outside this component
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
    setQuery(suburb.salName)
    setOpen(false)
    navigate(`/suburb/${suburb.salCode}`)
  }

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

          {results?.map((suburb) => (
            <button
              key={suburb.salCode}
              onClick={() => handleSelect(suburb)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
            >
              <span className="font-medium text-gray-900">{suburb.salName}</span>
              <span className="ml-2 text-sm text-gray-400">
                {suburb.stateName} · {suburb.gccsaName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

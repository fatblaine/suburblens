import { useState, useEffect, useRef } from 'react'
import { useSuburbSearch, maybeWarmup } from '../api/suburbs'
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
    <div ref={wrapperRef} className="w-full">
      {/* Positioning context for the dropdown: anchor it to the input, not the whole box */}
      <div className="relative">
        <div className="flex items-center gap-3 bg-surface-2 border border-white/12 rounded-xl px-5 focus-within:border-lemon/60 transition-colors">
          <span className="text-dim select-none">⌕</span>
          <input
            type="text"
            value={query}
            placeholder="Search a suburb, e.g. Glebe…"
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onKeyDown={(e) => {
              // With a single result, Enter selects it directly — no mouse needed.
              if (e.key === 'Enter' && showDropdown && !isPending && results?.length === 1) {
                const only = results[0]
                if (!selectedCodes.has(only.salCode)) {
                  e.preventDefault()
                  handleSelect(only)
                }
              }
            }}
            onFocus={() => { setOpen(true); maybeWarmup() }}
            className="flex-1 py-4 bg-transparent text-fg placeholder:text-dim focus:outline-none text-[17px]"
          />
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface-2 border border-white/12 rounded-xl shadow-2xl shadow-black/50 z-20 overflow-hidden">
            {isPending && (
              <div className="px-4 py-3 text-sm text-faint">Searching…</div>
            )}

            {!isPending && results?.length === 0 && (
              <div className="px-4 py-3 text-sm text-faint">No suburbs found.</div>
            )}

            {results?.map((suburb) => {
              const alreadyAdded = selectedCodes.has(suburb.salCode)
              return (
                <button
                  key={suburb.salCode}
                  onClick={() => handleSelect(suburb)}
                  disabled={alreadyAdded}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/[0.06] last:border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="font-medium text-fg">{suburb.salName}</span>
                  <span className="ml-2 text-sm text-faint">
                    {suburb.stateName} · {suburb.gccsaName}
                  </span>
                  {alreadyAdded && (
                    <span className="ml-2 font-mono text-xs text-lemon">Added</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2.5">
          {selected.map(suburb => (
            <span
              key={suburb.salCode}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface-3 border border-lemon/30 text-fg rounded-full text-sm"
            >
              {suburb.salName}
              <button
                onClick={() => onRemove(suburb.salCode)}
                className="text-faint hover:text-fg leading-none"
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
          className="mt-4 w-full py-3.5 bg-lemon hover:brightness-95 text-ink font-display font-semibold rounded-xl transition-all"
        >
          Compare {selected.length} suburb{selected.length > 1 ? 's' : ''}
        </button>
      )}

      {selected.length === 1 && (
        <button
          onClick={onNearby}
          className="mt-2.5 w-full py-3.5 border border-white/15 hover:border-white/30 text-fg font-display font-medium rounded-xl transition-colors"
        >
          Nearby Suburbs of {selected[0].salName}
        </button>
      )}
    </div>
  )
}

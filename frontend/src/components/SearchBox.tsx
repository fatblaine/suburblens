import { useState, useEffect, useRef } from 'react'
import { useSuburbSearch, maybeWarmup } from '../api/suburbs'
import type { SuburbSearchResult } from '../types/api'
import { shortSuburbName } from '../lib/trend'

interface Props {
  selected: SuburbSearchResult[]
  onAdd: (suburb: SuburbSearchResult) => void
  onRemove: (salCode: string) => void
  onCompare: () => void
  onNearby: () => void
  /** Clears every selected suburb. When given, the phone action bar shows "Clear". */
  onClear?: () => void
}

export default function SearchBox({ selected, onAdd, onRemove, onCompare, onNearby, onClear }: Props) {
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

  // One suburb → its profile with nearby suburbs open; two or more → compare.
  // shortLabel is for the narrow phone bar.
  const action =
    selected.length === 1
      ? {
          onClick: onNearby,
          label: `Details + Nearby Suburbs of ${selected[0].salName}`,
          shortLabel: `${shortSuburbName(selected[0].salName)}: details + nearby →`,
        }
      : selected.length > 1
        ? {
            onClick: onCompare,
            label: `Compare ${selected.length} suburbs →`,
            shortLabel: `Compare ${selected.length} suburbs →`,
          }
        : null

  const selectedCodes = new Set(selected.map(s => s.salCode))
  const showDropdown = open && debouncedQuery.trim().length >= 2

  return (
    <div
      ref={wrapperRef}
      className="w-full rounded-2xl bg-surface border border-white/[0.07] p-2.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)]"
    >
      {/* Positioning context for the dropdown: anchor it to the input, not the whole box */}
      <div className="relative">
        <div className="flex items-center gap-3 bg-surface-2 border border-white/12 rounded-xl px-4 focus-within:border-lemon/60 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-faint shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            aria-label="Search a suburb"
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
        <div className="mt-2.5 px-1 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint mr-1">
            {selected.length} selected
          </span>
          {selected.map(suburb => (
            <span
              key={suburb.salCode}
              className="inline-flex items-center gap-1 pl-3 pr-1 bg-surface-3 border border-white/[0.08] text-fg rounded-full text-sm"
            >
              {suburb.salName}
              <button
                type="button"
                onClick={() => onRemove(suburb.salCode)}
                aria-label={`Remove ${suburb.salName}`}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-fg"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {action && (
        <>
          {/* Tablet/desktop: the action sits inside the card. */}
          <button
            onClick={action.onClick}
            className="hidden sm:block mt-2.5 w-full py-3.5 bg-lemon hover:brightness-95 text-ink font-display font-semibold rounded-xl transition-all"
          >
            {action.label}
          </button>

          {/* Phone: a fixed bottom bar, always within thumb reach while the
              user scrolls the guide below. Pages using this should add bottom
              padding while something is selected so the bar never hides content. */}
          <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-ink-2/[0.97] border-t border-white/[0.08] shadow-[0_-16px_32px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between mb-2 font-mono text-[11px]">
              <span className="uppercase tracking-[0.1em] text-muted">{selected.length} selected</span>
              {onClear && (
                <button type="button" onClick={onClear} className="min-h-8 px-1 text-faint hover:text-fg">
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={action.onClick}
              className="w-full min-h-[52px] px-4 bg-lemon text-ink font-display font-semibold text-base rounded-xl truncate"
            >
              {action.shortLabel}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

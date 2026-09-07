import { useEffect, useRef } from 'react'

export interface Tab {
  key: string
  label: string
}

// Horizontally-scrollable pill strip with prev/next arrows. The arrows cycle the
// active tab, and the active pill auto-centres itself (mirrors the design mock).
//
// This is the WAI-ARIA tablist for the deck below it: role="tablist" sits on the
// inner scrolling div rather than the outer flex row, so the ‹ › arrow buttons
// are not announced as tabs. Focus moves with a roving tabindex — one stop for
// the whole strip, then arrow keys within it.
export default function TabStrip({
  tabs,
  active,
  onSelect,
  idPrefix,
}: {
  tabs: Tab[]
  active: number
  onSelect: (i: number) => void
  /** Namespaces the tab/panel ids. Cards stack on the detail page, so this must
   *  be unique per card — pass the salCode. */
  idPrefix: string
}) {
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const pill = el.querySelector<HTMLElement>(`[data-tab="${active}"]`)
    if (!pill) return
    const left = pill.offsetLeft - (el.clientWidth - pill.offsetWidth) / 2
    el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [active])

  const go = (n: number) => onSelect((n + tabs.length) % tabs.length)

  // Move selection AND focus together — with a roving tabindex the newly
  // selected pill is the only one still reachable, so focus has to follow.
  const focusTab = (i: number) => {
    go(i)
    const el = stripRef.current
    const next = (i + tabs.length) % tabs.length
    el?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') focusTab(active + 1)
    else if (e.key === 'ArrowLeft') focusTab(active - 1)
    else if (e.key === 'Home') focusTab(0)
    else if (e.key === 'End') focusTab(tabs.length - 1)
    else return
    e.preventDefault()
  }

  const arrow =
    'grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-white/[0.12] bg-surface-2 text-fg leading-none transition-colors hover:bg-surface-3 hover:border-white/25'

  return (
    <div className="flex items-center gap-1.5 border-b border-white/[0.07] pb-2.5">
      <button type="button" onClick={() => go(active - 1)} aria-label="Previous tab" className={arrow}>
        ‹
      </button>
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Suburb data sections"
        onKeyDown={onKeyDown}
        className="flex flex-1 gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t, i) => (
          <button
            key={t.key}
            data-tab={i}
            role="tab"
            id={`${idPrefix}-tab-${t.key}`}
            aria-selected={i === active}
            aria-controls={`${idPrefix}-panel-${t.key}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => onSelect(i)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider transition-colors ${
              i === active
                ? 'border-lemon bg-lemon text-ink'
                : 'border-white/10 bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg hover:border-white/25'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => go(active + 1)} aria-label="Next tab" className={arrow}>
        ›
      </button>
    </div>
  )
}

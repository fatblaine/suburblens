// Small segmented single-select control (year switcher, language/origin tabs).
// Rendered as a role="group" of aria-pressed buttons — simple, correct
// segmented-control semantics with no custom keyboard handling needed.
interface Option<T extends string> {
  value: T
  label: string
}

export default function SegmentToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
  tone = 'surface',
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  /** Extra layout classes for the container (margins, shrink, width). */
  className?: string
  /** Container background: 'surface' = bg-surface-2, 'overlay' = bg-white/10. */
  tone?: 'surface' | 'overlay'
}) {
  const bg = tone === 'overlay' ? 'bg-white/10' : 'bg-surface-2'
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex gap-1 ${bg} border border-white/10 rounded-lg p-1 ${className}`}
    >
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              active ? 'bg-lemon text-ink' : 'text-muted hover:text-fg'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

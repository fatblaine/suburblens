import type { TenureByYear } from '../types/api'
import { COLORS } from '../lib/theme'

const SLICES = [
  { key: 'outright' as const, label: 'Owned',    color: COLORS.owned },
  { key: 'mortgage' as const, label: 'Mortgage', color: COLORS.mortgage },
  { key: 'rent'     as const, label: 'Rented',   color: COLORS.rented },
]

type YearKey = 'y2011' | 'y2016' | 'y2021'
const YEARS: { key: YearKey; label: string }[] = [
  { key: 'y2011', label: '2011' },
  { key: 'y2016', label: '2016' },
  { key: 'y2021', label: '2021' },
]

interface Props {
  tenure: TenureByYear
}

/** One year = one horizontal stacked bar (owned / mortgage / rented),
 *  with mono percentage read-outs to the right. */
export default function TenureChart({ tenure }: Props) {
  return (
    <div>
      {/* legend */}
      <div className="flex justify-end gap-4 mb-5 text-xs text-muted">
        {SLICES.map(s => (
          <span key={s.key} className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {YEARS.map(({ key, label }, idx) => {
          const isLatest = idx === YEARS.length - 1
          return (
            <div key={key} className="flex items-center gap-4 sm:gap-5">
              <div
                className={`font-display font-bold text-lg w-12 shrink-0 ${isLatest ? 'text-fg' : 'text-dim'}`}
              >
                {label}
              </div>

              <div
                className="flex-1 h-8 rounded-lg overflow-hidden flex bg-track"
                style={isLatest ? { boxShadow: '0 0 0 1px rgba(198,242,78,0.33)' } : undefined}
              >
                {SLICES.map(s => {
                  const pct = tenure[s.key][key] ?? 0
                  return (
                    <div
                      key={s.key}
                      style={{ width: `${pct}%`, background: s.color }}
                      title={`${s.label} ${pct.toFixed(1)}%`}
                    />
                  )
                })}
              </div>

              <div className="hidden sm:flex w-[180px] shrink-0 gap-3 font-mono text-[13px]">
                {SLICES.map(s => {
                  const pct = tenure[s.key][key] ?? 0
                  return (
                    <span key={s.key} style={{ color: s.color }} className="w-1/3">
                      {pct.toFixed(1)}%
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

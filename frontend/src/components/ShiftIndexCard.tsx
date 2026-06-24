import type { TenureResponse } from '../types/api'

type TrendKey =
  | 'strong_ownership_shift'
  | 'mild_ownership_shift'
  | 'stable'
  | 'mild_rental_shift'
  | 'strong_rental_shift'

interface TrendStyle {
  gradient: string
  border: string
  accent: string   // big number + label colour
  body: string     // description colour
  divider: string
  label: string
  description: string
}

const TREND_CONFIG: Record<TrendKey, TrendStyle> = {
  strong_ownership_shift: {
    gradient: 'linear-gradient(120deg, #0f2a1c, #0c1a13)',
    border: 'rgba(63,185,127,0.30)',
    accent: '#5fd6a0',
    body: '#b7d9c8',
    divider: 'rgba(63,185,127,0.25)',
    label: 'Strong Ownership Shift',
    description: 'Owner-occupier share is rising significantly. Community stability is increasing.',
  },
  mild_ownership_shift: {
    gradient: 'linear-gradient(120deg, #112318, #0c1611)',
    border: 'rgba(63,185,127,0.22)',
    accent: '#5fd6a0',
    body: '#aecdbe',
    divider: 'rgba(63,185,127,0.18)',
    label: 'Mild Ownership Shift',
    description: 'Owner-occupier share is gradually increasing.',
  },
  stable: {
    gradient: 'linear-gradient(120deg, #161922, #11141b)',
    border: 'rgba(255,255,255,0.10)',
    accent: '#eef1f6',
    body: '#9aa0ad',
    divider: 'rgba(255,255,255,0.10)',
    label: 'Stable',
    description: 'Tenure composition has not changed significantly in recent years.',
  },
  mild_rental_shift: {
    gradient: 'linear-gradient(120deg, #2a1a10, #1a100b)',
    border: 'rgba(242,193,78,0.28)',
    accent: '#f2c14e',
    body: '#d9c2a0',
    divider: 'rgba(242,193,78,0.22)',
    label: 'Mild Rental Shift',
    description: 'Rental share is gradually increasing.',
  },
  strong_rental_shift: {
    gradient: 'linear-gradient(120deg, #2a1116, #1a0c10)',
    border: 'rgba(224,80,62,0.35)',
    accent: '#f2685c',
    body: '#d9b6b1',
    divider: 'rgba(224,80,62,0.25)',
    label: 'Strong Rental Shift',
    description: 'This area is being absorbed by investors. Rental share is rising significantly.',
  },
}

interface Props {
  residencyShiftIndex: TenureResponse['residencyShiftIndex']
  trendLabel: TenureResponse['trendLabel']
}

export default function ShiftIndexCard({ residencyShiftIndex, trendLabel }: Props) {
  const c = TREND_CONFIG[trendLabel as TrendKey] ?? TREND_CONFIG.stable

  return (
    <div
      className="rounded-2xl p-6 sm:p-7"
      style={{ background: c.gradient, border: `1px solid ${c.border}` }}
    >
      <div
        className="font-mono text-[11px] tracking-[0.16em] uppercase"
        style={{ color: c.accent, opacity: 0.8 }}
      >
        Residency Shift Index<span className="opacity-60"> · SuburbLens Custom</span>
      </div>

      <div className="mt-3 flex items-end gap-x-4 gap-y-1 flex-wrap">
        <span
          className="font-display font-bold text-6xl sm:text-7xl leading-[0.85] tracking-tight"
          style={{ color: c.accent }}
        >
          {residencyShiftIndex != null ? residencyShiftIndex.toFixed(1) : '--'}
        </span>
        <span
          className="font-display font-semibold text-xl sm:text-2xl pb-1"
          style={{ color: c.accent }}
        >
          {c.label}
        </span>
      </div>

      <p
        className="mt-5 pt-4 border-t text-[15px] leading-relaxed"
        style={{ color: c.body, borderColor: c.divider }}
      >
        {c.description}
      </p>
    </div>
  )
}

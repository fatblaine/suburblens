import type { TenureResponse } from '../types/api'

type TrendKey =
  | 'strong_ownership_shift'
  | 'mild_ownership_shift'
  | 'stable'
  | 'mild_rental_shift'
  | 'strong_rental_shift'

const TREND_CONFIG: Record<TrendKey, {
  bg: string
  text: string
  label: string
  description: string
}> = {
  strong_ownership_shift: {
    bg: 'bg-emerald-500/20 border border-emerald-400/30',
    text: 'text-emerald-100',
    label: 'Strong Ownership Shift',
    description: 'Owner-occupier share is rising significantly. Community stability is increasing.',
  },
  mild_ownership_shift: {
    bg: 'bg-emerald-500/10 border border-emerald-400/20',
    text: 'text-emerald-200',
    label: 'Mild Ownership Shift',
    description: 'Owner-occupier share is gradually increasing.',
  },
  stable: {
    bg: 'bg-white/10 border border-white/15',
    text: 'text-white/80',
    label: 'Stable',
    description: 'Tenure composition has not changed significantly in recent years.',
  },
  mild_rental_shift: {
    bg: 'bg-orange-500/15 border border-orange-400/25',
    text: 'text-orange-200',
    label: 'Mild Rental Shift',
    description: 'Rental share is gradually increasing.',
  },
  strong_rental_shift: {
    bg: 'bg-red-500/20 border border-red-400/30',
    text: 'text-red-200',
    label: 'Strong Rental Shift',
    description: 'This area is being absorbed by investors. Rental share is rising significantly.',
  },
}

interface Props {
  residencyShiftIndex: TenureResponse['residencyShiftIndex']
  trendLabel: TenureResponse['trendLabel']
}

export default function ShiftIndexCard({ residencyShiftIndex, trendLabel }: Props) {
  const config = TREND_CONFIG[trendLabel as TrendKey] ?? TREND_CONFIG.stable

  return (
    <div className={`rounded-2xl p-6 backdrop-blur-sm ${config.bg}`}>
      <p className={`text-sm font-medium mb-2 ${config.text} opacity-75`}>
        Residency Shift Index
        <span className="ml-2 text-xs opacity-60">— SuburbLens Custom</span>
      </p>

      <div className="flex items-baseline gap-3">
        <span className={`text-5xl font-bold ${config.text}`}>
          {residencyShiftIndex != null ? residencyShiftIndex.toFixed(1) : '--'}
        </span>
        <span className={`text-xl font-semibold ${config.text}`}>
          {config.label}
        </span>
      </div>

      <p className={`mt-2 text-sm ${config.text} opacity-80`}>
        {config.description}
      </p>
    </div>
  )
}

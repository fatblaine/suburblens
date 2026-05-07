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
    bg: 'bg-green-600',
    text: 'text-white',
    label: 'Strong Ownership Shift',
    description: 'Owner-occupier share is rising significantly. Community stability is increasing.',
  },
  mild_ownership_shift: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Mild Ownership Shift',
    description: 'Owner-occupier share is gradually increasing.',
  },
  stable: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    label: 'Stable',
    description: 'Tenure composition has not changed significantly in recent years.',
  },
  mild_rental_shift: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    label: 'Mild Rental Shift',
    description: 'Rental share is gradually increasing.',
  },
  strong_rental_shift: {
    bg: 'bg-red-100',
    text: 'text-red-800',
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
    <div className={`rounded-2xl p-6 ${config.bg}`}>
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

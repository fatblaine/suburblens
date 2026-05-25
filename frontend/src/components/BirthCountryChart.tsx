import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { BirthCountryResponse, BirthCountryYearData, CountryEntry } from '../types/api'

const PALETTE = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
  '#f59e0b', '#f97316', '#ef4444', '#8b5cf6',
  '#ec4899', '#84cc16',
]

type YearKey = 'y2011' | 'y2016' | 'y2021'
const YEARS: YearKey[] = ['y2011', 'y2016', 'y2021']
const YEAR_LABEL: Record<YearKey, string> = { y2011: '2011', y2016: '2016', y2021: '2021' }

function migrantDelta(
  y2011: BirthCountryYearData | null,
  y2021: BirthCountryYearData | null,
): number | null {
  const aus11 = y2011?.countries.find(c => c.country === 'Australia')?.pct ?? null
  const aus21 = y2021?.countries.find(c => c.country === 'Australia')?.pct ?? null
  return aus11 != null && aus21 != null ? aus21 - aus11 : null
}

function MigrantBadge({ delta }: { delta: number }) {
  const abs = Math.abs(delta).toFixed(1)
  if (delta < -2) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
      ↑ {abs}pp more overseas-born since 2011
    </span>
  )
  if (delta > 2) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
      ↑ {abs}pp more Australia-born since 2011
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      → Origins mix stable since 2011
    </span>
  )
}

function SnapshotBars({ yearData }: { yearData: BirthCountryYearData }) {
  const entries: CountryEntry[] = yearData.countries
    .filter(c => (c.pct ?? 0) >= 0.3)
    .slice(0, 10)

  const maxPct = entries[0]?.pct ?? 1

  return (
    <div className="space-y-2">
      {entries.map((c, i) => {
        const barWidth = ((c.pct ?? 0) / maxPct) * 100
        const isAustralia = c.country === 'Australia'
        return (
          <div key={c.country} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-right">
              <span className={`text-xs truncate block ${isAustralia ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>
                {c.country}
              </span>
            </div>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: isAustralia ? '#6366f1' : PALETTE[(i) % PALETTE.length],
                  minWidth: '2px',
                }}
              />
            </div>
            <div className="w-11 shrink-0 text-right">
              <span className={`text-xs ${isAustralia ? 'font-bold text-gray-800' : 'font-medium text-gray-700'}`}>
                {c.pct?.toFixed(1)}%
              </span>
            </div>
          </div>
        )
      })}
      {yearData.totalPersons != null && (
        <p className="text-xs text-gray-400 pt-1">
          {yearData.totalPersons.toLocaleString()} residents responded
        </p>
      )}
    </div>
  )
}

const TOOLTIP_STYLE = {
  fontSize: 12, borderRadius: 8,
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.06)',
  padding: '8px 12px',
}

function TrendLines({ response }: { response: BirthCountryResponse }) {
  const top4 = (response.y2021?.countries ?? [])
    .filter(c => c.country !== 'Australia')
    .slice(0, 4)

  const tracked = [
    { country: 'Australia', color: '#6366f1' },
    ...top4.map((c, i) => ({ country: c.country, color: PALETTE[(i + 1) % PALETTE.length] })),
  ]

  const data = YEARS.map(yr => {
    const row: Record<string, string | number | null> = { year: YEAR_LABEL[yr] }
    tracked.forEach(({ country }) => {
      const match = response[yr]?.countries.find(c => c.country === country)
      row[country] = match?.pct ?? null
    })
    return row
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
          <Tooltip
            formatter={(value: number, name: string) => [`${value?.toFixed(1)}%`, name]}
            contentStyle={TOOLTIP_STYLE}
          />
          {tracked.map(({ country, color }, i) => (
            <Line
              key={country}
              type="monotone"
              dataKey={country}
              stroke={color}
              strokeWidth={i === 0 ? 3 : 2}
              dot={{ r: i === 0 ? 5 : 4, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 7, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {tracked.map(({ country, color }, i) => (
          <div key={country} className="flex items-center gap-1.5">
            <span className="shrink-0 rounded-full" style={{
              width: i === 0 ? 10 : 8, height: i === 0 ? 10 : 8, backgroundColor: color,
            }} />
            <span className={`text-xs ${i === 0 ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>
              {country}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props { response: BirthCountryResponse }

export default function BirthCountryChart({ response }: Props) {
  const [year, setYear] = useState<YearKey>('y2021')
  const yearData = response[year]
  const delta = migrantDelta(response.y2011, response.y2021)

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Where are residents born?</p>
            <p className="text-xs text-gray-400 mt-0.5">% of residents by country of birth</p>
          </div>
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-1 shrink-0 ml-4">
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  year === y ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {YEAR_LABEL[y]}
              </button>
            ))}
          </div>
        </div>
        {yearData
          ? <SnapshotBars yearData={yearData} />
          : <p className="text-sm text-gray-400">No data available.</p>
        }
      </div>

      <div className="border-t border-gray-100" />

      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">How are origins changing?</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Australia-born + top overseas countries across census years
            </p>
          </div>
          {delta != null && (
            <div className="ml-4 shrink-0">
              <MigrantBadge delta={delta} />
            </div>
          )}
        </div>
        <TrendLines response={response} />
      </div>
    </div>
  )
}

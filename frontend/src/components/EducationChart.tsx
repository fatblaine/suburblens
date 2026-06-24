import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { EducationResponse, EducationYearData } from '../types/api'
import { COLORS, TOOLTIP_STYLE } from '../lib/theme'

const LEVEL_COLORS: Record<string, string> = {
  'Postgraduate':        '#c6f24e',
  'Grad Diploma/Cert':   '#9bd96f',
  'Bachelor Degree':     '#5fd6a0',
  'Adv Diploma/Diploma': '#f2c14e',
  'Certificate III/IV':  '#f29e54',
  'Certificate I/II':    '#f2685c',
}

const UNIVERSITY_LABELS = ['Postgraduate', 'Grad Diploma/Cert', 'Bachelor Degree']

type YearKey = 'y2011' | 'y2016' | 'y2021'
const YEARS: YearKey[] = ['y2011', 'y2016', 'y2021']
const YEAR_LABEL: Record<YearKey, string> = { y2011: '2011', y2016: '2016', y2021: '2021' }

const TREND_LINES = [
  { key: 'University',          color: COLORS.lemon },
  { key: 'Certificate III/IV',  color: '#f29e54' },
  { key: 'Adv Diploma/Diploma', color: COLORS.mortgage },
]

// ── University badge ──────────────────────────────────────────────────────────

function UniversityBadge({ pct2011, pct2021 }: { pct2011: number | null; pct2021: number | null }) {
  if (pct2021 == null) return null
  const delta = pct2011 != null ? pct2021 - pct2011 : null

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-lemon/15 text-lemon">
        🎓 {pct2021.toFixed(1)}% university-qualified (2021)
      </span>
      {delta != null && Math.abs(delta) >= 1 && (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
          delta > 0 ? 'bg-lemon/15 text-lemon' : 'bg-white/10 text-muted'
        }`}>
          {delta > 0
            ? `↑ ${delta.toFixed(1)}pp since 2011`
            : `↓ ${Math.abs(delta).toFixed(1)}pp since 2011`}
        </span>
      )}
    </div>
  )
}

// ── Snapshot bars ─────────────────────────────────────────────────────────────

function SnapshotBars({ yearData }: { yearData: EducationYearData }) {
  const levels = yearData.levels.filter(l => l.pct != null && l.pct > 0)
  const maxPct = Math.max(...levels.map(l => l.pct ?? 0), 1)

  return (
    <div className="space-y-2">
      {levels.map(level => {
        const barWidth = ((level.pct ?? 0) / maxPct) * 100
        const isUni = UNIVERSITY_LABELS.includes(level.label)
        const color = LEVEL_COLORS[level.label] ?? COLORS.lemon

        return (
          <div key={level.label} className="flex items-center gap-3">
            <div className="w-36 shrink-0 text-right">
              <span className={`text-xs truncate block ${isUni ? 'font-semibold text-white' : 'text-white/60'}`}>
                {level.label}
              </span>
            </div>
            <div className="flex-1 h-5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: color, minWidth: '2px' }}
              />
            </div>
            <div className="w-11 shrink-0 text-right">
              <span className={`text-xs ${isUni ? 'font-bold text-white' : 'font-medium text-white/80'}`}>
                {level.pct?.toFixed(1)}%
              </span>
            </div>
          </div>
        )
      })}
      {yearData.totalPersons != null && (
        <p className="text-xs text-white/40 pt-1">
          {yearData.totalPersons.toLocaleString()} persons aged 15+
        </p>
      )}
    </div>
  )
}

// ── Trend lines ───────────────────────────────────────────────────────────────

function TrendChart({ response }: { response: EducationResponse }) {
  const data = YEARS.map(yr => {
    const yd = response[yr]
    const row: Record<string, string | number | null> = { year: YEAR_LABEL[yr] }
    row['University'] = yd?.universityPct ?? null
    TREND_LINES.slice(1).forEach(({ key }) => {
      row[key] = yd?.levels.find(l => l.label === key)?.pct ?? null
    })
    return row
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            contentStyle={TOOLTIP_STYLE}
          />
          {TREND_LINES.map(({ key, color }, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
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
        {TREND_LINES.map(({ key, color }, i) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="shrink-0 rounded-full" style={{
              width: i === 0 ? 10 : 8, height: i === 0 ? 10 : 8, backgroundColor: color,
            }} />
            <span className={`text-xs ${i === 0 ? 'font-semibold text-white' : 'text-white/60'}`}>{key}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function EducationChart({ response }: { response: EducationResponse }) {
  const [year, setYear] = useState<YearKey>('y2021')
  const yearData = response[year]

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white">What qualifications do residents hold?</p>
            <p className="text-xs text-white/40 mt-0.5">% of persons aged 15+ by highest qualification</p>
          </div>
          <div className="flex gap-0.5 bg-white/10 border border-white/10 rounded-lg p-1 shrink-0 ml-4">
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  year === y ? 'bg-lemon text-ink' : 'text-muted hover:text-fg'
                }`}
              >
                {YEAR_LABEL[y]}
              </button>
            ))}
          </div>
        </div>

        <UniversityBadge
          pct2011={response.y2011?.universityPct ?? null}
          pct2021={response.y2021?.universityPct ?? null}
        />

        {yearData
          ? <SnapshotBars yearData={yearData} />
          : <p className="text-sm text-white/40">No data available.</p>
        }
      </div>

      <div className="border-t border-white/10" />

      <div>
        <p className="text-sm font-semibold text-white mb-1">How is education changing?</p>
        <p className="text-xs text-white/40 mb-4">University-qualified rate + vocational across census years</p>
        <TrendChart response={response} />
      </div>
    </div>
  )
}

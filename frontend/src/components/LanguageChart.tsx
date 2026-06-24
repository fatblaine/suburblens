import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { LanguageResponse, LanguageYearData, LanguageEntry } from '../types/api'
import { CHART_PALETTE as PALETTE, COLORS, TOOLTIP_STYLE as TREND_TOOLTIP_STYLE } from '../lib/theme'

type YearKey = 'y2011' | 'y2016' | 'y2021'
const YEARS: YearKey[] = ['y2011', 'y2016', 'y2021']
const YEAR_LABEL: Record<YearKey, string> = { y2011: '2011', y2016: '2016', y2021: '2021' }

// ── Diversity badge ───────────────────────────────────────────────────────────

function diversityDelta(
  y2011: LanguageYearData | null,
  y2021: LanguageYearData | null,
): number | null {
  const eng11 = y2011?.languages.find(l => l.language === 'English only')?.pct ?? null
  const eng21 = y2021?.languages.find(l => l.language === 'English only')?.pct ?? null
  return eng11 != null && eng21 != null ? eng21 - eng11 : null
}

function DiversityBadge({ delta }: { delta: number }) {
  const abs = Math.abs(delta).toFixed(1)
  if (delta < -2) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/20 text-teal-300">
      ↑ {abs}pp more diverse since 2011
    </span>
  )
  if (delta > 2) return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300">
      ↓ {abs}pp less diverse since 2011
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-white/50">
      → Language mix stable since 2011
    </span>
  )
}

// ── Q1: Snapshot bar chart ────────────────────────────────────────────────────

function SnapshotBars({ yearData }: { yearData: LanguageYearData }) {
  const entries: LanguageEntry[] = yearData.languages
    .filter(l => (l.pct ?? 0) >= 0.3)
    .slice(0, 10)

  const maxPct = entries[0]?.pct ?? 1

  return (
    <div className="space-y-2">
      {entries.map((lang, i) => {
        const barWidth = ((lang.pct ?? 0) / maxPct) * 100
        const isEnglish = lang.language === 'English only'

        return (
          <div key={lang.language} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-right">
              <span className={`text-xs truncate block ${isEnglish ? 'font-semibold text-white' : 'text-white/60'}`}>
                {lang.language}
              </span>
            </div>
            <div className="flex-1 h-5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: isEnglish ? COLORS.lemon : PALETTE[(i) % PALETTE.length],
                  minWidth: '2px',
                }}
              />
            </div>
            <div className="w-11 shrink-0 text-right">
              <span className={`text-xs ${isEnglish ? 'font-bold text-white' : 'font-medium text-white/80'}`}>
                {lang.pct?.toFixed(1)}%
              </span>
            </div>
          </div>
        )
      })}

      {yearData.totalPersons != null && (
        <p className="text-xs text-white/40 pt-1 pl-31">
          {yearData.totalPersons.toLocaleString()} residents responded
        </p>
      )}
    </div>
  )
}

// ── Q2: Trend line chart ──────────────────────────────────────────────────────

function TrendLines({ response }: { response: LanguageResponse }) {
  const nonEnglish = (response.y2021?.languages ?? [])
    .filter(l => l.language !== 'English only')
    .slice(0, 4)

  const tracked = [
    { language: 'English only', color: COLORS.lemon, dash: '' },
    ...nonEnglish.map((l, i) => ({
      language: l.language,
      color: PALETTE[(i + 1) % PALETTE.length],
      dash: '',
    })),
  ]

  const data = YEARS.map(yr => {
    const row: Record<string, string | number | null> = { year: YEAR_LABEL[yr] }
    tracked.forEach(({ language }) => {
      const match = response[yr]?.languages.find(l => l.language === language)
      row[language] = match?.pct ?? null
    })
    return row
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            contentStyle={TREND_TOOLTIP_STYLE}
          />
          {tracked.map(({ language, color }, i) => (
            <Line
              key={language}
              type="monotone"
              dataKey={language}
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
        {tracked.map(({ language, color }, i) => (
          <div key={language} className="flex items-center gap-1.5">
            <span className="shrink-0 rounded-full" style={{
              width: i === 0 ? 10 : 8,
              height: i === 0 ? 10 : 8,
              backgroundColor: color,
            }} />
            <span className={`text-xs ${i === 0 ? 'font-semibold text-white' : 'text-white/60'}`}>
              {language}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  response: LanguageResponse
}

export default function LanguageChart({ response }: Props) {
  const [year, setYear] = useState<YearKey>('y2021')
  const yearData = response[year]
  const delta = diversityDelta(response.y2011, response.y2021)

  return (
    <div className="space-y-8">

      {/* ── Q1: Snapshot ─────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white">
              What languages are spoken at home?
            </p>
            <p className="text-xs text-white/40 mt-0.5">% of residents by language</p>
          </div>

          <div className="flex gap-0.5 bg-white/10 border border-white/10 rounded-lg p-1 shrink-0 ml-4">
            {YEARS.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  year === y
                    ? 'bg-lemon text-ink'
                    : 'text-muted hover:text-fg'
                }`}
              >
                {YEAR_LABEL[y]}
              </button>
            ))}
          </div>
        </div>

        {yearData
          ? <SnapshotBars yearData={yearData} />
          : <p className="text-sm text-white/40">No data available.</p>
        }
      </div>

      <div className="border-t border-white/10" />

      {/* ── Q2: Trend ────────────────────────────────── */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white">
              How is the language mix changing?
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              English only + top non-English languages across census years
            </p>
          </div>
          {delta != null && (
            <div className="ml-4 shrink-0">
              <DiversityBadge delta={delta} />
            </div>
          )}
        </div>

        <TrendLines response={response} />
      </div>

    </div>
  )
}

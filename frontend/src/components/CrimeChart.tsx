import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { CrimeResponse } from '../types/api'
import { COLORS, TOOLTIP_STYLE } from '../lib/theme'

const CATEGORY_LABEL: Record<string, string> = {
  assault:         'Assault',
  break_enter:     'Break & enter',
  theft:           'Theft',
  robbery:         'Robbery',
  property_damage: 'Property damage',
  other:           'Other',
}

// Warning-tone ramp (dark → light), most-serious first.
const CATEGORY_COLOR: Record<string, string> = {
  assault:         '#f2685c',
  break_enter:     '#f2865c',
  theft:           '#f29e54',
  robbery:         '#f2b04e',
  property_damage: '#f2c14e',
  other:           '#7d8290',
}

export default function CrimeChart({ response }: { response: CrimeResponse }) {
  const periods = response.periods
  if (periods.length === 0) return null

  const latest = periods[periods.length - 1]
  const prev = periods.length > 1 ? periods[periods.length - 2] : null
  const trend = periods.map(p => ({ year: String(p.yearEnding), total: p.total }))
  const maxCat = Math.max(...latest.categories.map(c => c.incidents), 1)

  const delta = prev ? latest.total - prev.total : null
  const deltaPct = prev && prev.total > 0 ? (delta! / prev.total) * 100 : null

  return (
    <div className="space-y-6">
      {/* Headline: latest year total + YoY delta */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-faint">
            Recorded incidents · year ending {latest.yearEnding}
          </p>
          <p className="font-display text-3xl text-fg mt-1">
            {latest.total.toLocaleString()}
          </p>
        </div>
        {delta != null && (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono"
            style={{
              color: delta > 0 ? COLORS.rented : COLORS.owned,
              background: (delta > 0 ? COLORS.rented : COLORS.owned) + '22',
            }}
          >
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString()}
            {deltaPct != null && ` (${Math.abs(deltaPct).toFixed(0)}%)`} vs {prev!.yearEnding}
          </span>
        )}
      </div>

      {/* Benchmark vs Greater Melbourne — ranked by count, not per person */}
      {response.benchmark && response.benchmark.cohortCount > 1 && (() => {
        const bm = response.benchmark!
        const max = bm.cohortMax || 1
        const pct = Math.round(bm.percentileRank * 100)
        return (
          <div className="rounded-lg bg-surface-2 border border-white/[0.07] p-4 space-y-3">
            <p className="font-mono text-xs uppercase tracking-wider text-faint">
              Crime rank vs Greater Melbourne · {latest.yearEnding}
            </p>
            <p className="text-sm text-muted">
              More incidents than{' '}
              <span className="font-display text-lemon text-base">{pct}%</span>{' '}
              of {bm.cohortCount.toLocaleString()} suburbs
            </p>
            {/* position on 0 -> busiest scale; white tick = cohort median */}
            <div className="relative h-2">
              <div className="absolute inset-0 rounded-full bg-surface-3 overflow-hidden">
                <div className="h-full bg-lemon/70"
                     style={{ width: `${Math.min(100, (bm.total / max) * 100)}%` }} />
              </div>
              <span className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 rounded bg-white/50"
                    style={{ left: `${Math.min(100, (bm.medianTotal / max) * 100)}%` }}
                    title="Greater Melbourne median" />
            </div>
            <p className="font-mono text-xs text-muted flex flex-wrap gap-x-4 gap-y-0.5">
              <span>median {Math.round(bm.medianTotal).toLocaleString()}</span>
              <span>this suburb {bm.total.toLocaleString()}</span>
              <span>busiest {bm.cohortMax.toLocaleString()}</span>
            </p>
          </div>
        )
      })()}

      {/* Trend line — the primary read */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }}
                 axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                 axisLine={false} tickLine={false}
                 tickFormatter={v => v.toLocaleString()} width={48} />
          <Tooltip
            formatter={(value) => [Number(value).toLocaleString(), 'Incidents']}
            contentStyle={TOOLTIP_STYLE}
          />
          <Line type="monotone" dataKey="total" stroke={COLORS.rented}
                strokeWidth={3} dot={{ r: 4, fill: COLORS.rented, strokeWidth: 0 }}
                activeDot={{ r: 7, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>

      {/* Latest-year breakdown by category */}
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-faint mb-3">
          By offence type · {latest.yearEnding}
        </p>
        <div className="space-y-2">
          {latest.categories.map(c => (
            <div key={c.category} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-muted">
                {CATEGORY_LABEL[c.category] ?? c.category}
              </span>
              <div className="flex-1 h-4 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(c.incidents / maxCat) * 100}%`,
                    background: CATEGORY_COLOR[c.category] ?? '#7d8290',
                  }}
                />
              </div>
              <span className="w-12 text-right font-mono text-sm text-fg">
                {c.incidents.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

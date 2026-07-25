import type { CompareReportRow } from '../api/suburbs'
import type {
  YearValues,
  LanguageResponse,
  BirthCountryResponse,
  EducationResponse,
  CrimeResponse,
} from '../types/api'

/**
 * Print-first comparison report — a light, compact <table> built purely for
 * PDF export. It is rendered off-screen and printed on its own via
 * react-to-print, so it deliberately does NOT use the app's dark Nocturne
 * tokens: all colours are literal light values, all numbers monospace.
 *
 * Layout: metrics as rows, suburbs as columns (the "comparison table" the user
 * picked). Each logical section is its own <tbody> so it never splits across a
 * page break.
 */

// —— formatting helpers ——

const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(1)}%`

const fmtNum = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('en-AU')

/** Latest-year value with the 2011→2021 change appended, e.g. "12.5%  ▲2.2". */
function TenureCell({ vals }: { vals: YearValues }) {
  const now = vals.y2021
  if (now == null) return <>—</>
  const base = vals.y2011
  if (base == null) return <>{now.toFixed(1)}%</>
  const d = now - base
  const arrow = d > 0.05 ? '▲' : d < -0.05 ? '▼' : '▬'
  const color = d > 0.05 ? '#1a7a4a' : d < -0.05 ? '#b23b30' : '#999'
  return (
    <>
      {now.toFixed(1)}%{' '}
      <span style={{ color }} className="text-[10px]">
        {arrow}{Math.abs(d).toFixed(1)}
      </span>
    </>
  )
}

function englishOnlyPct(lang?: LanguageResponse): number | null {
  return lang?.y2021?.languages.find(l => l.language === 'English only')?.pct ?? null
}

/** "Mandarin 14% · Greek 8% · Italian 6%" (top 3 non-English, 2021). */
function topLanguages(lang?: LanguageResponse): string {
  const list = (lang?.y2021?.languages ?? [])
    .filter(l => l.language !== 'English only' && (l.pct ?? 0) > 0)
    .slice(0, 3)
  if (list.length === 0) return '—'
  return list.map(l => `${l.language} ${l.pct?.toFixed(0)}%`).join(' · ')
}

/** Top 3 overseas countries (2021), Australia excluded. */
function topCountries(birth?: BirthCountryResponse): string {
  const list = (birth?.y2021?.countries ?? [])
    .filter(c => c.country.toLowerCase() !== 'australia' && (c.pct ?? 0) > 0)
    .slice(0, 3)
  if (list.length === 0) return '—'
  return list.map(c => `${c.country} ${c.pct?.toFixed(0)}%`).join(' · ')
}

function universityPct(edu?: EducationResponse): number | null {
  return edu?.y2021?.universityPct ?? null
}

/** "top 12%" from the city percentile rank, or null if no benchmark. */
function eduRank(edu?: EducationResponse): string | null {
  const p = edu?.benchmark?.percentileRank
  if (p == null) return null
  return `top ${Math.max(1, Math.round((1 - p) * 100))}% in ${edu?.benchmark?.cohortName ?? 'city'}`
}

function crimeTotal(crime?: CrimeResponse): { total: number | null; year: number | null } {
  const latest = crime?.periods?.[crime.periods.length - 1]
  return { total: latest?.total ?? null, year: latest?.yearEnding ?? null }
}

// —— cell / row primitives ——

const LABEL = 'px-3 py-1.5 text-left text-[12px] text-[#555] align-top'
const VALUE = 'px-3 py-1.5 text-right text-[12px] text-[#111] font-mono align-top break-words'
const ROW = 'border-b border-[#ececec]'
const WIN_MAX = 'bg-[#eef7c9]' // lemon — highest value in the row
const WIN_MIN = 'bg-[#dff3e4]' // green — lowest value in the row (used for crime)

/** Positions holding the max/min value. All false if <2 values or all equal. */
function extremes(values: (number | null | undefined)[], mode: 'max' | 'min'): boolean[] {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length < 2) return values.map(() => false)
  const target = mode === 'max' ? Math.max(...nums) : Math.min(...nums)
  if (nums.every(v => v === target)) return values.map(() => false)
  return values.map(v => v != null && v === target)
}

/** One metric row that auto-highlights the winning cell (max, or min for crime). */
function CompareRow({
  label,
  rows,
  valueOf,
  render,
  cellClass = '',
  highlight = 'max',
}: {
  label: string
  rows: CompareReportRow[]
  valueOf: (r: CompareReportRow) => number | null | undefined
  render: (r: CompareReportRow) => React.ReactNode
  cellClass?: string
  highlight?: 'max' | 'min'
}) {
  const win = extremes(rows.map(valueOf), highlight)
  const winClass = highlight === 'min' ? WIN_MIN : WIN_MAX
  return (
    <tr className={ROW}>
      <td className={LABEL}>{label}</td>
      {rows.map((r, i) => (
        <td
          key={r.tenure.salCode}
          className={VALUE + (cellClass ? ' ' + cellClass : '') + (win[i] ? ' font-bold ' + winClass : '')}
        >
          {render(r)}
        </td>
      ))}
    </tr>
  )
}

function SectionHead({ span, children }: { span: number; children: React.ReactNode }) {
  return (
    <tr>
      <td
        colSpan={span}
        className="px-3 pt-3 pb-1 bg-[#f4f4f4] text-[#6a6a6a] font-mono text-[10px] uppercase tracking-[0.12em]"
      >
        {children}
      </td>
    </tr>
  )
}

// —— main ——

export default function CompareReport({
  rows,
  widthPx = 700,
}: {
  rows: CompareReportRow[]
  /** Rendered width in px — set by ComparePage to the printable page width. */
  widthPx?: number
}) {
  if (rows.length === 0) return null
  const span = rows.length + 1
  const generatedAt = new Date().toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div
      className="bg-white text-[#111] font-sans"
      style={{ width: widthPx, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {/* Header */}
      <div className="border-b-2 border-[#111] pb-3 mb-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#888]">
          SuburbLens · ABS Census
        </div>
        <h1 className="font-display text-[20px] font-bold leading-tight mt-1">
          Suburb Comparison
        </h1>
        <div className="text-[11px] text-[#777] mt-0.5">
          {rows.map(r => r.tenure.salName).join('  ·  ')} — generated {generatedAt}
        </div>
      </div>

      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col style={{ width: 130 }} />
          {rows.map(r => <col key={r.tenure.salCode} />)}
        </colgroup>
        {/* Suburb column headers */}
        <thead>
          <tr>
            <th className="px-3 py-2 text-left align-bottom border-b-2 border-[#111]" />
            {rows.map(r => (
              <th
                key={r.tenure.salCode}
                className="px-3 py-2 text-right align-bottom border-b-2 border-[#111]"
              >
                <div className="font-display font-bold text-[13px] text-[#111] leading-tight">
                  {r.tenure.salName}
                </div>
                <div className="text-[9px] text-[#888] font-normal font-sans mt-0.5">
                  {r.tenure.stateName} · {r.tenure.gccsaName}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Residency Shift Index */}
        <tbody className="break-inside-avoid">
          <SectionHead span={span}>Residency Shift Index · SuburbLens Custom</SectionHead>
          <CompareRow
            label="Index & trend"
            rows={rows}
            valueOf={r => r.tenure.residencyShiftIndex}
            render={r => (
              <>
                <span className="text-[13px]">{r.tenure.residencyShiftIndex ?? '—'}</span>
                <div className="text-[10px] text-[#777] font-sans font-normal">
                  {r.tenure.trendLabel}
                </div>
              </>
            )}
          />
        </tbody>

        {/* Tenure */}
        <tbody className="break-inside-avoid">
          <SectionHead span={span}>Tenure · 2021 (change since 2011)</SectionHead>
          {([
            ['Owned outright', 'outright'],
            ['With a mortgage', 'mortgage'],
            ['Rented', 'rent'],
          ] as const).map(([label, key]) => (
            <CompareRow
              key={key}
              label={label}
              rows={rows}
              valueOf={r => r.tenure.tenure[key].y2021}
              render={r => <TenureCell vals={r.tenure.tenure[key]} />}
            />
          ))}
        </tbody>

        {/* Community — language */}
        <tbody className="break-inside-avoid">
          <SectionHead span={span}>Community · Language at home · 2021</SectionHead>
          <CompareRow
            label="English only"
            rows={rows}
            valueOf={r => englishOnlyPct(r.language)}
            render={r => fmtPct(englishOnlyPct(r.language))}
          />
          <tr className={ROW}>
            <td className={LABEL}>Top other languages</td>
            {rows.map(r => (
              <td key={r.tenure.salCode} className={VALUE + ' !whitespace-normal text-[11px]'}>
                {topLanguages(r.language)}
              </td>
            ))}
          </tr>
        </tbody>

        {/* Community — country of birth */}
        <tbody className="break-inside-avoid">
          <SectionHead span={span}>Community · Country of birth · 2021</SectionHead>
          <tr className={ROW}>
            <td className={LABEL}>Top overseas origins</td>
            {rows.map(r => (
              <td key={r.tenure.salCode} className={VALUE + ' !whitespace-normal text-[11px]'}>
                {topCountries(r.birthCountry)}
              </td>
            ))}
          </tr>
        </tbody>

        {/* Education */}
        <tbody className="break-inside-avoid">
          <SectionHead span={span}>Education · 2021</SectionHead>
          <CompareRow
            label="University-qualified"
            rows={rows}
            valueOf={r => universityPct(r.education)}
            render={r => (
              <>
                {fmtPct(universityPct(r.education))}
                {eduRank(r.education) && (
                  <div className="text-[10px] text-[#777] font-sans font-normal">
                    {eduRank(r.education)}
                  </div>
                )}
              </>
            )}
          />
        </tbody>

        {/* Crime (Greater Melbourne only) */}
        <tbody className="break-inside-avoid">
          <SectionHead span={span}>Crime · recorded incidents / yr · Greater Melbourne only</SectionHead>
          <CompareRow
            label="Total incidents"
            rows={rows}
            valueOf={r => crimeTotal(r.crime).total}
            highlight="min"
            render={r => {
              const { total, year } = crimeTotal(r.crime)
              return (
                <>
                  {fmtNum(total)}
                  {total != null && year != null && (
                    <div className="text-[10px] text-[#777] font-sans font-normal">
                      yr ending {year}
                    </div>
                  )}
                </>
              )
            }}
          />
        </tbody>
      </table>

      {/* Disclaimer — required: Residency Shift Index must be labelled custom */}
      <p className="mt-4 text-[10px] leading-relaxed text-[#777]">
        <strong style={{ color: '#111' }}>Highlighted</strong> = the highest value in that row;
        for crime, <strong style={{ color: '#1a7a4a' }}>green</strong> marks the lowest (fewest
        incidents).<br />
        <strong className="text-[#555]">Note:</strong> The Residency Shift Index is a SuburbLens
        custom heuristic based on 2016→2021 tenure changes; it is not an official ABS metric.
        Census figures are ABS 2011 / 2016 / 2021 (SA2, mapped to the searched suburb). Crime data
        is Victoria Police (year ending March) and is available for Greater Melbourne suburbs only —
        “—” means no crime data for that suburb.
      </p>
    </div>
  )
}

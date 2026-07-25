import type { CSSProperties } from 'react'
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
 * react-to-print.
 *
 * IMPORTANT: this component styles itself with INLINE styles, not Tailwind
 * classes. react-to-print clones this DOM into a separate print document; in a
 * production build the app's CSS is an external <link> that the print window
 * does not reliably load, which stripped every Tailwind utility from the PDF
 * (backgrounds, borders, fonts all gone). Inline styles travel with the cloned
 * nodes, so they always apply regardless of how/where the app is bundled.
 *
 * Layout: metrics as rows, suburbs as columns. Each logical section is its own
 * <tbody> so it never splits across a page break.
 */

const MONO = "'IBM Plex Mono', ui-monospace, monospace"
const SANS = "'IBM Plex Sans', system-ui, sans-serif"
const DISPLAY = "'Space Grotesk', system-ui, sans-serif"

// —— shared inline styles ——

const S = {
  eyebrow: {
    fontFamily: MONO,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: '#888',
  },
  h1: { fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, lineHeight: 1.1, margin: '4px 0 0' },
  headerSub: { fontSize: 11, color: '#777', marginTop: 2 },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  thBlank: { padding: '8px 12px', textAlign: 'left', verticalAlign: 'bottom', borderBottom: '2px solid #111' },
  thSuburb: { padding: '8px 12px', textAlign: 'right', verticalAlign: 'bottom', borderBottom: '2px solid #111' },
  thName: { fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, color: '#111', lineHeight: 1.1 },
  thMeta: { fontSize: 9, color: '#888', fontWeight: 400, fontFamily: SANS, marginTop: 2 },
  sectionHead: {
    padding: '12px 12px 4px',
    background: '#f4f4f4',
    color: '#6a6a6a',
    fontFamily: MONO,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  },
  row: { borderBottom: '1px solid #ececec' },
  label: { padding: '6px 12px', textAlign: 'left', fontSize: 12, color: '#555', verticalAlign: 'top' },
  value: {
    padding: '6px 12px',
    textAlign: 'right',
    fontSize: 12,
    color: '#111',
    fontFamily: MONO,
    verticalAlign: 'top',
    wordBreak: 'break-word',
  },
  subValue: { fontSize: 10, color: '#777', fontFamily: SANS, fontWeight: 400 },
  note: { marginTop: 16, fontSize: 10, lineHeight: 1.6, color: '#777' },
} satisfies Record<string, CSSProperties>

const WIN_MAX: CSSProperties = { background: '#eef7c9', fontWeight: 700 } // lemon — highest value
const WIN_MIN: CSSProperties = { background: '#dff3e4', fontWeight: 700 } // green — lowest value (crime)

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
      <span style={{ color, fontSize: 10 }}>
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

// —— row / cell primitives ——

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
  cellStyle,
  highlight = 'max',
}: {
  label: string
  rows: CompareReportRow[]
  valueOf: (r: CompareReportRow) => number | null | undefined
  render: (r: CompareReportRow) => React.ReactNode
  cellStyle?: CSSProperties
  highlight?: 'max' | 'min'
}) {
  const win = extremes(rows.map(valueOf), highlight)
  const winStyle = highlight === 'min' ? WIN_MIN : WIN_MAX
  return (
    <tr style={S.row}>
      <td style={S.label}>{label}</td>
      {rows.map((r, i) => (
        <td
          key={r.tenure.salCode}
          style={{ ...S.value, ...cellStyle, ...(win[i] ? winStyle : null) }}
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
      <td colSpan={span} style={S.sectionHead}>
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
      style={{
        width: widthPx,
        background: '#ffffff',
        color: '#111',
        fontFamily: SANS,
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 8 }}>
        <div style={S.eyebrow}>SuburbLens · ABS Census</div>
        <h1 style={S.h1}>Suburb Comparison</h1>
        <div style={S.headerSub}>
          {rows.map(r => r.tenure.salName).join('  ·  ')} — generated {generatedAt}
        </div>
      </div>

      <table style={S.table}>
        <colgroup>
          <col style={{ width: 130 }} />
          {rows.map(r => <col key={r.tenure.salCode} />)}
        </colgroup>
        {/* Suburb column headers */}
        <thead>
          <tr>
            <th style={S.thBlank} />
            {rows.map(r => (
              <th key={r.tenure.salCode} style={S.thSuburb}>
                <div style={S.thName}>{r.tenure.salName}</div>
                <div style={S.thMeta}>
                  {r.tenure.stateName} · {r.tenure.gccsaName}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Residency Shift Index */}
        <tbody style={{ breakInside: 'avoid' }}>
          <SectionHead span={span}>Residency Shift Index · SuburbLens Custom</SectionHead>
          <CompareRow
            label="Index & trend"
            rows={rows}
            valueOf={r => r.tenure.residencyShiftIndex}
            render={r => (
              <>
                <span style={{ fontSize: 13 }}>{r.tenure.residencyShiftIndex ?? '—'}</span>
                <div style={S.subValue}>{r.tenure.trendLabel}</div>
              </>
            )}
          />
        </tbody>

        {/* Tenure */}
        <tbody style={{ breakInside: 'avoid' }}>
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
        <tbody style={{ breakInside: 'avoid' }}>
          <SectionHead span={span}>Community · Language at home · 2021</SectionHead>
          <CompareRow
            label="English only"
            rows={rows}
            valueOf={r => englishOnlyPct(r.language)}
            render={r => fmtPct(englishOnlyPct(r.language))}
          />
          <tr style={S.row}>
            <td style={S.label}>Top other languages</td>
            {rows.map(r => (
              <td key={r.tenure.salCode} style={{ ...S.value, whiteSpace: 'normal', fontSize: 11 }}>
                {topLanguages(r.language)}
              </td>
            ))}
          </tr>
        </tbody>

        {/* Community — country of birth */}
        <tbody style={{ breakInside: 'avoid' }}>
          <SectionHead span={span}>Community · Country of birth · 2021</SectionHead>
          <tr style={S.row}>
            <td style={S.label}>Top overseas origins</td>
            {rows.map(r => (
              <td key={r.tenure.salCode} style={{ ...S.value, whiteSpace: 'normal', fontSize: 11 }}>
                {topCountries(r.birthCountry)}
              </td>
            ))}
          </tr>
        </tbody>

        {/* Education */}
        <tbody style={{ breakInside: 'avoid' }}>
          <SectionHead span={span}>Education · 2021</SectionHead>
          <CompareRow
            label="University-qualified"
            rows={rows}
            valueOf={r => universityPct(r.education)}
            render={r => (
              <>
                {fmtPct(universityPct(r.education))}
                {eduRank(r.education) && <div style={S.subValue}>{eduRank(r.education)}</div>}
              </>
            )}
          />
        </tbody>

        {/* Crime (Greater Melbourne only) — fewest incidents highlighted in green */}
        <tbody style={{ breakInside: 'avoid' }}>
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
                    <div style={S.subValue}>yr ending {year}</div>
                  )}
                </>
              )
            }}
          />
        </tbody>
      </table>

      {/* Disclaimer — required: Residency Shift Index must be labelled custom */}
      <p style={S.note}>
        <strong style={{ color: '#111' }}>Highlighted</strong> = the highest value in that row;
        for crime, <strong style={{ color: '#1a7a4a' }}>green</strong> marks the lowest (fewest
        incidents).<br />
        <strong style={{ color: '#555' }}>Note:</strong> The Residency Shift Index is a SuburbLens
        custom heuristic based on 2016→2021 tenure changes; it is not an official ABS metric.
        Census figures are ABS 2011 / 2016 / 2021 (SA2, mapped to the searched suburb). Crime data
        is Victoria Police (year ending March) and is available for Greater Melbourne suburbs only —
        “—” means no crime data for that suburb.
      </p>
    </div>
  )
}

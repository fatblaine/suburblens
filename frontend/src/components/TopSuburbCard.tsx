import { Link } from 'react-router-dom'
import {
  usePopularSuburbs,
  useSuburbTenure,
  useSuburbLanguage,
  useSuburbEducation,
  useSuburbDistances,
} from '../api/suburbs'
import { COLORS } from '../lib/theme'
import { trendTag, stateAndPostcode, shortSuburbName } from '../lib/trend'
import { track } from '../lib/analytics'

const YEARS = [
  { key: 'y2011', label: '2011' },
  { key: 'y2016', label: '2016' },
  { key: 'y2021', label: '2021' },
] as const

const km = (m: number) => `${(m / 1000).toFixed(1)} km`
const pct = (v: number | null | undefined) => (v == null ? '–' : `${v.toFixed(1)}%`)

function Stat({ label, value, note, noteClass = 'text-muted' }: {
  label: string
  value: string
  note?: string
  noteClass?: string
}) {
  return (
    <div className="bg-surface px-4 py-3.5 min-w-0">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint truncate">{label}</div>
      <div className="font-display font-semibold text-[26px] leading-tight mt-1 truncate">{value}</div>
      {note && <div className={`font-mono text-xs truncate ${noteClass}`}>{note}</div>}
    </div>
  )
}

// The #1 most-viewed suburb of the last 30 days, as a preview of what a
// profile contains. Shares the popular-suburbs query with PopularSuburbs and
// MostViewedSection (same key), so the list itself costs no extra request;
// the four detail queries reuse the same cache entries the profile page uses.
export default function TopSuburbCard() {
  const { data: popular, isLoading: popularLoading } = usePopularSuburbs(8)
  const top = popular?.[0]
  const code = top?.salCode

  const tenure = useSuburbTenure(code)
  const language = useSuburbLanguage(code)
  const education = useSuburbEducation(code)
  const distances = useSuburbDistances(code)

  // Nothing to feature (no views yet / view missing): leave the column empty
  // rather than inventing a suburb.
  if (!popularLoading && !top) return null

  if (popularLoading || tenure.isLoading) {
    return <div aria-hidden="true" className="h-[480px] rounded-[20px] bg-surface border border-white/[0.07] animate-pulse" />
  }
  if (!top || !tenure.data) return null

  const t = tenure.data.tenure
  const tag = trendTag(tenure.data.trendLabel)
  const rentNow = t.rent.y2021
  const rentThen = t.rent.y2011
  const rentDelta = rentNow != null && rentThen != null ? rentNow - rentThen : null

  const topLanguage = language.data?.y2021?.languages.find(
    l => l.language !== 'English only' && l.language !== 'Other',
  )
  const uni = education.data?.y2021?.universityPct ?? null
  const uniMedian = education.data?.benchmark?.medianPct ?? null
  const cityShort = top.gccsaName.replace('Greater ', '')

  const list = distances.data?.distances ?? []
  const cbd = list.find(d => d.category === 'cbd')
  const nearestUni = list
    .filter(d => d.category === 'university')
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0]

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Most viewed this month</span>
        <span className="px-2 py-0.5 rounded-md bg-lemon/15 text-lemon font-mono text-[11px]">#1</span>
      </div>

      <Link
        to={`/suburb/${top.salCode}`}
        onClick={() => track('top_suburb_click', { sal_code: top.salCode })}
        className="block rounded-[20px] bg-surface border border-white/[0.07] p-6 sm:p-[26px] text-fg shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] transition-colors hover:border-lemon/30"
      >
        <div className="flex justify-between items-start gap-3 mb-5">
          <div className="min-w-0">
            <div className="font-display font-bold text-[26px] tracking-tight truncate" title={top.salName}>{shortSuburbName(top.salName)}</div>
            <div className="text-[13px] text-faint mt-0.5">
              {stateAndPostcode(top.stateName, tenure.data.postcode)}
              {cbd && ` · ${km(cbd.distanceMeters)} to ${cbd.shortName ?? cbd.name}`}
            </div>
          </div>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-full font-mono text-[11px] whitespace-nowrap ${tag.className}`}
            title="Residency Shift Index · SuburbLens Custom"
          >
            {tag.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px bg-white/[0.07] border border-white/[0.07] rounded-xl overflow-hidden mb-5">
          <Stat
            label="Homes rented"
            value={pct(rentNow)}
            note={rentDelta != null ? `${rentDelta >= 0 ? '+' : ''}${rentDelta.toFixed(1)} pts since 2011` : undefined}
            noteClass={tag.deltaClassName}
          />
          <Stat
            label="Top language"
            value={topLanguage?.language ?? '–'}
            note={topLanguage?.pct != null ? `${topLanguage.pct.toFixed(1)}% of residents` : undefined}
          />
          <Stat
            label="University educated"
            value={pct(uni)}
            note={uniMedian != null ? `${cityShort} median ${uniMedian.toFixed(1)}%` : undefined}
            noteClass="text-lemon"
          />
          <Stat
            label={nearestUni ? `To ${nearestUni.shortName ?? nearestUni.name}` : 'Nearest uni'}
            value={nearestUni ? km(nearestUni.distanceMeters) : '–'}
            note="straight line"
          />
        </div>

        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted mb-2.5">Tenure, 2011 → 2021</div>
        <div className="flex flex-col gap-2">
          {YEARS.map(({ key, label }) => {
            const latest = key === 'y2021'
            return (
              <div key={key} className={`flex items-center gap-2.5 font-mono text-xs ${latest ? 'text-lemon font-semibold' : 'text-faint'}`}>
                <span className="w-[34px]">{label}</span>
                <div
                  className={`flex-1 flex h-2.5 rounded-[3px] overflow-hidden bg-track ${latest ? 'ring-1 ring-lemon ring-offset-2 ring-offset-surface' : ''}`}
                  role="img"
                  aria-label={`${label}: owned ${pct(t.outright[key])}, mortgage ${pct(t.mortgage[key])}, rented ${pct(t.rent[key])}`}
                >
                  <div style={{ width: `${t.outright[key] ?? 0}%`, background: COLORS.owned }} />
                  <div style={{ width: `${t.mortgage[key] ?? 0}%`, background: COLORS.mortgage }} />
                  <div style={{ width: `${t.rent[key] ?? 0}%`, background: COLORS.rented }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-between items-center gap-3 mt-5 pt-4 border-t border-white/[0.07]">
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-owned" />Owned</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-mortgage" />Mortgage</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-rented" />Rented</span>
          </div>
          <span className="font-mono text-xs text-lemon whitespace-nowrap">View details →</span>
        </div>
      </Link>
    </div>
  )
}

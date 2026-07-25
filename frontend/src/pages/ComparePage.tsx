import { useRef, useState, useEffect } from 'react'
import { useReactToPrint } from 'react-to-print'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSuburbTenureBatch, useSuburbLanguage, useSuburbBirthCountry, useSuburbEducation, useSuburbCrime, useCompareReport, recordSuburbView } from '../api/suburbs'
import PageMeta from '../components/PageMeta'
import ShiftIndexCard from '../components/ShiftIndexCard'
import TenureChart from '../components/TenureChart'
import LanguageChart from '../components/LanguageChart'
import BirthCountryChart from '../components/BirthCountryChart'
import EducationChart from '../components/EducationChart'
import CrimeChart from '../components/CrimeChart'
import CompareReport from '../components/CompareReport'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { track } from '../lib/analytics'

type CommunityTab = 'language' | 'birthcountry'

const GLASS_CARD = 'bg-surface border border-white/[0.07] shadow-xl shadow-black/30 rounded-2xl'

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={GLASS_CARD}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-white/40 transition-transform duration-200 ml-4 shrink-0 ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  )
}

function EducationSection({ salCode }: { salCode: string }) {
  const { data, isPending } = useSuburbEducation(salCode)

  if (isPending) return (
    <div className={GLASS_CARD + ' p-6'}>
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-36 h-3 bg-white/10 rounded" />
            <div className="flex-1 h-4 bg-white/10 rounded-full" />
            <div className="w-10 h-3 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  )

  if (!data) return null

  return (
    <CollapsibleSection
      title="Education Level"
      subtitle="Highest qualification · 2011 / 2016 / 2021"
    >
      <EducationChart response={data} />
      <p className="mt-5 text-xs text-white/40">&#9432; {data.dataNote}</p>
    </CollapsibleSection>
  )
}

function CrimeSection({ salCode }: { salCode: string }) {
  const { data, isPending, isError } = useSuburbCrime(salCode)

  // 404 (non-Melbourne / no data) → silently render nothing
  if (isError) return null

  if (isPending) return (
    <div className={GLASS_CARD + ' p-6'}>
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 h-3 bg-white/10 rounded" />
            <div className="flex-1 h-4 bg-white/10 rounded-full" />
            <div className="w-10 h-3 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  )

  if (!data) return null

  return (
    <CollapsibleSection
      title="Crime"
      subtitle="Recorded incidents · year ending March · Greater Melbourne"
    >
      <CrimeChart response={data} />
      <p className="mt-5 text-xs text-white/40">&#9432; {data.dataNote}</p>
    </CollapsibleSection>
  )
}

function CommunitySection({ salCode }: { salCode: string }) {
  const [tab, setTab] = useState<CommunityTab>('language')
  const lang = useSuburbLanguage(salCode)
  const birth = useSuburbBirthCountry(salCode)

  if (lang.isPending) return (
    <div className={GLASS_CARD + ' p-6'}>
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-24 h-3 bg-white/10 rounded" />
            <div className="flex-1 h-4 bg-white/10 rounded-full" />
            <div className="w-10 h-3 bg-white/10 rounded" />
          </div>
        ))}
      </div>
    </div>
  )

  if (!lang.data && !birth.data) return null

  const dataNote = tab === 'language' ? lang.data?.dataNote : birth.data?.dataNote

  return (
    <CollapsibleSection
      title="Community Profile"
      subtitle="Language & origins · 2011 / 2016 / 2021"
    >
      <div className="flex gap-1 bg-surface-2 border border-white/10 rounded-lg p-1 w-fit mb-5">
        <button
          onClick={() => setTab('language')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            tab === 'language' ? 'bg-lemon text-ink' : 'text-muted hover:text-fg'
          }`}
        >
          Language at Home
        </button>
        <button
          onClick={() => setTab('birthcountry')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
            tab === 'birthcountry' ? 'bg-lemon text-ink' : 'text-muted hover:text-fg'
          }`}
        >
          Country of Birth
        </button>
      </div>

      {tab === 'language' && lang.data && <LanguageChart response={lang.data} />}
      {tab === 'birthcountry' && birth.data && <BirthCountryChart response={birth.data} />}

      {dataNote && <p className="mt-4 text-xs text-white/40">&#9432; {dataNote}</p>}
    </CollapsibleSection>
  )
}

export default function ComparePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const salCodes = searchParams.getAll('codes')

  const { data, isPending, isError } = useSuburbTenureBatch(salCodes)

  // Data + DOM node for the print-only PDF report (see CompareReport.tsx).
  const report = useCompareReport(salCodes, data)
  const printRef = useRef<HTMLDivElement>(null)

  // Names arrive with the batch response; before that fall back to a generic
  // title rather than flashing the salCodes, which mean nothing to a reader.
  const names = data?.map(d => d.salName) ?? []
  const shown = names.slice(0, 3).join(' vs ')
  const compareTitle = names.length
    ? `${shown}${names.length > 3 ? ` +${names.length - 3} more` : ''} — compare suburbs | SuburbLens`
    : 'Compare suburbs | SuburbLens'
  const compareDesc = names.length
    ? `Side-by-side ABS Census comparison of ${names.join(', ')} — tenure trends, languages, countries of birth, and education.`
    : 'Compare Sydney and Melbourne suburbs side by side using ABS Census data.'

  // Default PDF file name. Cap at 3 names so it never grows unwieldy.
  const documentTitle = names.length
    ? `SuburbLens — ${names.slice(0, 3).join(' vs ')}${names.length > 3 ? ` +${names.length - 3} more` : ''}`
    : 'SuburbLens Comparison'

  // 3+ suburbs get wide fast, so print those in landscape. Width below is the
  // A4 printable area (page − 2×12mm margin) at 96dpi, so the report fills the
  // page without overflowing/clipping. `html/body` is forced white because the
  // app's global dark background would otherwise print behind the report.
  const landscape = (data?.length ?? 0) >= 3
  const reportWidthPx = landscape ? 1024 : 700
  const pageStyle = `
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm; }
    html, body { background: #ffffff !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  `
  const handleExport = useReactToPrint({ contentRef: printRef, documentTitle, pageStyle })

  // Count a comparison once its data resolves — one event per distinct set of
  // suburbs, not per re-render or refetch.
  // This is the page the home-page search actually lands on, so it is also where
  // most suburb views happen — every code in the URL counts as one view for the
  // popular-suburbs list (recordSuburbView dedupes per tab on its own).
  const compareKey = salCodes.join(',')
  const firedRef = useRef('')
  useEffect(() => {
    if (!data || firedRef.current === compareKey) return
    firedRef.current = compareKey
    track('compare_run', { count: salCodes.length, codes: compareKey })
    salCodes.forEach(recordSuburbView)
  }, [compareKey, data, salCodes])

  if (salCodes.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center px-4">
        <p className="text-white/60 mb-4">No suburbs selected for comparison.</p>
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white/80 underline text-sm">
          ← Search again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent">
      <PageMeta title={compareTitle} description={compareDesc} />
      <div className="max-w-7xl mx-auto px-4 py-10">

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-white/50 hover:text-white/80 text-sm transition-colors mb-8"
        >
          ← Search again
        </button>

        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-fg">Suburb Comparison</h1>
          {data && (
            <button
              onClick={() => {
                track('report_export', { page: 'compare', count: salCodes.length })
                handleExport()
              }}
              disabled={report.isPending}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-lemon px-4 py-2 text-sm font-semibold text-ink transition-colors hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {report.isPending ? 'Preparing…' : 'Export PDF'}
            </button>
          )}
        </div>

        {isPending && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {salCodes.map(code => (
              <div key={code} className={GLASS_CARD + ' p-6'}>
                <LoadingSkeleton />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p className="text-red-400">Failed to load comparison data. Please try again.</p>
        )}

        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.map(suburb => (
              <div key={suburb.salCode} className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-fg">{suburb.salName}</h2>
                  <p className="text-muted text-sm">{suburb.stateName} · {suburb.gccsaName}</p>
                </div>

                <ShiftIndexCard
                  residencyShiftIndex={suburb.residencyShiftIndex}
                  trendLabel={suburb.trendLabel}
                />

                <CollapsibleSection
                  title="Tenure Time Machine"
                  subtitle="% of occupied dwellings · 2011 / 2016 / 2021"
                >
                  <TenureChart tenure={suburb.tenure} />
                  <p className="mt-3 text-xs text-white/40">
                    &#9432; Data sourced from ABS SA2: <strong>{suburb.sa2Name}</strong>
                  </p>
                </CollapsibleSection>

                <CommunitySection salCode={suburb.salCode} />

                <EducationSection salCode={suburb.salCode} />

                <CrimeSection salCode={suburb.salCode} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-white/10 border border-amber-300/30 rounded-xl p-4 text-sm text-amber-200">
          <strong>Note:</strong> The Residency Shift Index is a SuburbLens custom heuristic based on
          2016&rarr;2021 tenure changes. It does not represent an official ABS metric.
        </div>

      </div>

      {/* Print-only PDF report: rendered off-screen (has real layout so
          react-to-print can measure it) and printed on its own via handleExport. */}
      {data && (
        <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0">
          <div ref={printRef}>
            <CompareReport rows={report.rows} widthPx={reportWidthPx} />
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import SuburbCard from '../components/SuburbCard'
import PageMeta from '../components/PageMeta'
import { useSuburbTenure, recordSuburbView } from '../api/suburbs'
import { track } from '../lib/analytics'

const FALLBACK_DESC =
  'Compare Sydney and Melbourne suburbs using ABS Census data — tenure trends, community languages, and education levels.'

// Title/description for the suburb the URL points at. Reuses the query
// SuburbCard already issues for the same salCode, so this costs no extra
// request — it reads the same TanStack cache entry.
function useSuburbMeta(salCode: string | undefined) {
  const { data } = useSuburbTenure(salCode)
  if (!data) return null

  const where = data.stateName ? `${data.salName}, ${data.stateName}` : data.salName
  const now = data.tenure?.rent?.y2021
  const then = data.tenure?.rent?.y2016

  let sentence = `${where}: ABS Census tenure, language, origin and education data.`
  if (now != null) {
    const trend =
      then == null ? ''
        : now > then ? `, up from ${then.toFixed(1)}% in 2016`
        : now < then ? `, down from ${then.toFixed(1)}% in 2016`
        : `, unchanged since 2016`
    sentence = `${where}: ${now.toFixed(1)}% of homes were rented in 2021${trend}. Census tenure, language, origin and education data.`
  }

  return { title: `${data.salName} — tenure & Census data | SuburbLens`, description: sentence }
}

export default function SuburbDetailPage() {
  const { salCode: urlSalCode } = useParams<{ salCode: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultNearbyExpanded = searchParams.get('nearby') === '1'
  const meta = useSuburbMeta(urlSalCode)

  // One view event per suburb the URL points at. page_title already carries the
  // suburb name, so we only send the code here.
  // Two sinks: GA4 (for us) and our own suburb_views table (feeds the home
  // page's "popular this month" list). Only the URL suburb counts — cards the
  // user later adds to the stack are not a deliberate visit.
  useEffect(() => {
    if (!urlSalCode) return
    track('suburb_view', { sal_code: urlSalCode })
    recordSuburbView(urlSalCode)  // fire-and-forget; stats must never block the page
  }, [urlSalCode])

  // 页面上显示的 suburb 列表，从 URL 的那个开始
  const [salCodes, setSalCodes] = useState<string[]>([urlSalCode!])

  // 每张卡片的容器引用 + 待滚动目标（新加入的 suburb）
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // 用 ref 存一次性的滚动目标：读完即清，避免在 effect 里再 setState
  const scrollToRef = useRef<string | null>(null)

  // 列表更新、目标卡片挂载后再滚动过去
  useEffect(() => {
    if (!scrollToRef.current) return
    cardRefs.current[scrollToRef.current]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    scrollToRef.current = null
  }, [salCodes])

  function addSuburb(code: string) {
    setSalCodes(prev => (prev.includes(code) ? prev : [...prev, code]))
    // 已存在也滚过去，方便定位
    scrollToRef.current = code
  }

  function removeSuburb(code: string) {
    setSalCodes(prev => {
      const next = prev.filter(c => c !== code)
      // 如果全删完了就回首页
      if (next.length === 0) navigate('/')
      return next
    })
  }

  return (
    <div className="min-h-screen bg-transparent">
      <PageMeta
        title={meta?.title ?? 'Suburb — SuburbLens'}
        description={meta?.description ?? FALLBACK_DESC}
      />
      <div className="max-w-2xl mx-auto px-4 py-10">

        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-white/50 hover:text-white/80 text-sm transition-colors mb-8"
        >
          ← Search again
        </button>

        <div className="space-y-12">
          {salCodes.map((code, index) => (
            <div key={code} ref={el => { cardRefs.current[code] = el }} className="scroll-mt-6">
              {/* 第二张卡片起加分割线 */}
              {index > 0 && <hr className="border-white/10 mb-12" />}
              <SuburbCard
                salCode={code}
                onAdd={addSuburb}
                onRemove={() => removeSuburb(code)}
                defaultNearbyExpanded={index === 0 && defaultNearbyExpanded}
              />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import SuburbCard from '../components/SuburbCard'

export default function SuburbDetailPage() {
  const { salCode: urlSalCode } = useParams<{ salCode: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultNearbyExpanded = searchParams.get('nearby') === '1'

  // 页面上显示的 suburb 列表，从 URL 的那个开始
  const [salCodes, setSalCodes] = useState<string[]>([urlSalCode!])

  // 每张卡片的容器引用 + 待滚动目标（新加入的 suburb）
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [scrollTo, setScrollTo] = useState<string | null>(null)

  // 列表更新、目标卡片挂载后再滚动过去
  useEffect(() => {
    if (!scrollTo) return
    cardRefs.current[scrollTo]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setScrollTo(null)
  }, [salCodes, scrollTo])

  function addSuburb(code: string) {
    setSalCodes(prev => (prev.includes(code) ? prev : [...prev, code]))
    // 已存在也滚过去，方便定位
    setScrollTo(code)
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

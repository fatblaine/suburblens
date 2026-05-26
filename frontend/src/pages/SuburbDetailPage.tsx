import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import LoadingSkeleton from '../components/LoadingSkeleton'
import SuburbCard from '../components/SuburbCard'
import { useSuburbTenure } from '../api/suburbs'

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center px-4">
      <p className="text-white/60 text-lg mb-4">No data found for this suburb.</p>
      <button onClick={onBack} className="text-white/50 hover:text-white/80 underline text-sm">
        ← Go back
      </button>
    </div>
  )
}

function InitialLoader({ salCode }: { salCode: string }) {
  const { isPending, isError } = useSuburbTenure(salCode)
  if (isPending) return (
    <div className="min-h-screen bg-transparent px-4 py-10">
      <div className="max-w-2xl mx-auto"><LoadingSkeleton /></div>
    </div>
  )
  if (isError) return null
  return null
}

export default function SuburbDetailPage() {
  const { salCode: urlSalCode } = useParams<{ salCode: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultNearbyExpanded = searchParams.get('nearby') === '1'

  // 页面上显示的 suburb 列表，从 URL 的那个开始
  const [salCodes, setSalCodes] = useState<string[]>([urlSalCode!])

  function addSuburb(code: string) {
    // 已经在列表里就不重复添加
    setSalCodes(prev => prev.includes(code) ? prev : [...prev, code])
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
            <div key={code}>
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

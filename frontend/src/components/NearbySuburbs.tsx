import { useState } from 'react'
import { useNearbySuburbs } from '../api/suburbs'

interface Props {
  salCode: string
  defaultExpanded?: boolean
  onSelect: (salCode: string) => void  // 点击 nearby suburb 时通知父组件，不跳页
}

export default function NearbySuburbs({ salCode, defaultExpanded = false, onSelect }: Props) {

  // 从 defaultExpanded 初始化，让详情页能通过 URL 参数控制默认展开
  const [expanded, setExpanded] = useState(defaultExpanded)

  // enabled 依赖 expanded：只有用户点了按钮才真正发请求
  const { data, isPending, isError } = useNearbySuburbs(salCode, 5, expanded)

  return (
    <div className="mt-8">

      {/* 触发按钮：点击切换展开/折叠 */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-400 hover:shadow-sm transition"
      >
        <span className="font-medium text-gray-700">Nearby Suburbs</span>
        {/* 箭头图标随展开状态旋转 */}
        <span className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* 只有 expanded 为 true 才渲染内容区 */}
      {expanded && (
        <div className="mt-2 flex flex-col gap-2">

          {isPending && (
            // 骨架屏：请求还没回来时占位
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </>
          )}

          {isError && (
            <p className="text-sm text-red-400 px-1">Failed to load nearby suburbs.</p>
          )}

          {data && data.nearby.length === 0 && (
            <p className="text-sm text-gray-400 px-1">No nearby suburbs found within 20 km.</p>
          )}

          {data && data.nearby.map((suburb) => (
            <button
              key={suburb.salCode}
              onClick={() => onSelect(suburb.salCode)}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 text-left hover:border-blue-400 hover:shadow-sm transition"
            >
              <div>
                <span className="font-medium text-gray-800">{suburb.salName}</span>
                <span className="text-sm text-gray-400 ml-2">{suburb.gccsaName}</span>
              </div>

              {/* >= 1000m 转成 km */}
              <span className="text-sm text-gray-400 shrink-0 ml-4">
                {suburb.distanceMeters >= 1000
                  ? `${(suburb.distanceMeters / 1000).toFixed(1)} km`
                  : `${suburb.distanceMeters} m`}
              </span>
            </button>
          ))}

        </div>
      )}

    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import type { SuburbSearchResult, TenureResponse, NearbySuburbsResponse, LanguageResponse, BirthCountryResponse, EducationResponse, CrimeResponse } from '../types/api'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// —— Lambda 冷启动预热：时间自愈守卫 ——
// lastRequestAt：最后一次真正打到 Lambda 的请求时间戳（毫秒）。真实搜索与预热都刷新它。
// 模块作用域共享（不放组件 state / localStorage）——刷新页面自然归零，保证首进必预热。
let lastRequestAt = 0
const WARM_WINDOW_MS = 4 * 60 * 1000  // < Lambda 热窗口(~5-15min)，留安全余量

// 任何唤醒 Lambda 的请求（真实搜索 / 预热）回来后调它「保存」时间戳
function markRequest() {
    lastRequestAt = Date.now()
}

// focus 时调用：只有超过热窗口（= 冷启动真会发生时）才发一条预热请求，结果丢弃
export function maybeWarmup() {
    if (Date.now() - lastRequestAt < WARM_WINDOW_MS) return  // 还热 → 跳过，零浪费
    markRequest()                                            // 预热也算一次唤醒
    // 复用搜索端点做预热；keepalive 让请求不被页面卸载打断；结果不进缓存
    fetch(`${API_BASE}/api/suburbs/search?q=sy`, { keepalive: true }).catch(() => {})
}

// Search for suburbs by name
export function useSuburbSearch(query: string) {
    return useQuery<SuburbSearchResult[]>({
        queryKey: ['suburbSearch', query],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/suburbs/search?q=${encodeURIComponent(query)}`)
            markRequest()  // fetch 返回即视为 Lambda 已唤醒，刷新时间戳
            if (!res.ok) throw new Error('Failed to search suburbs.')
            return res.json()
        },
        enabled: query.trim().length >= 2,
        staleTime: 5 * 60 * 1000
    })
}

// Fetch tenure data for a suburb by its salCode
export function useSuburbTenure(salCode: string | undefined) {
    return useQuery<TenureResponse>({
        queryKey: ['suburb-tenure', salCode],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/suburbs/${salCode}/tenure`)
            if (!res.ok) throw new Error('Failed to fetch suburb tenure data.')
            return res.json()
        },
        enabled: !!salCode,
        staleTime: 5 * 60 * 1000
    })
}

// Fetch nearby suburbs for a given salCode
// enabled 参数由外部控制，只有用户点了按钮才传 true 触发请求
export function useNearbySuburbs(salCode: string | undefined, limit = 5, enabled = false) {
    return useQuery<NearbySuburbsResponse>({
        queryKey: ['nearby', salCode, limit],  // 不同 salCode 各自缓存
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/suburbs/${salCode}/nearby?limit=${limit}`)
            if (!res.ok) throw new Error('Failed to fetch nearby suburbs.')
            return res.json()
        },
        enabled: !!salCode && enabled,  // salCode 存在 且 用户已展开，才发请求
        staleTime: 10 * 60 * 1000  // 地理数据不变，缓存 10 分钟
    })
}

// Fetch language profile for a suburb by its salCode
export function useSuburbLanguage(salCode: string | undefined) {
    return useQuery<LanguageResponse>({
        queryKey: ['suburb-language', salCode],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/suburbs/${salCode}/language`)
            if (!res.ok) throw new Error('Failed to fetch suburb language data.')
            return res.json()
        },
        enabled: !!salCode,
        staleTime: 5 * 60 * 1000
    })
}

// Fetch country of birth profile for a suburb by its salCode
export function useSuburbBirthCountry(salCode: string | undefined) {
    return useQuery<BirthCountryResponse>({
        queryKey: ['suburb-birthcountry', salCode],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/suburbs/${salCode}/birthcountry`)
            if (!res.ok) throw new Error('Failed to fetch suburb birth country data.')
            return res.json()
        },
        enabled: !!salCode,
        staleTime: 5 * 60 * 1000,
        retry: 0,
    })
}

// Fetch education level profile for a suburb by its salCode
export function useSuburbEducation(salCode: string | undefined) {
    return useQuery<EducationResponse>({
        queryKey: ['suburb-education', salCode],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/suburbs/${salCode}/education`)
            if (!res.ok) throw new Error('Failed to fetch suburb education data.')
            return res.json()
        },
        enabled: !!salCode,
        staleTime: 5 * 60 * 1000,
        retry: 0,
    })
}

// Fetch recorded crime incidents for a suburb (Greater Melbourne only; 404 elsewhere)
export function useSuburbCrime(salCode: string | undefined) {
    return useQuery<CrimeResponse>({
        queryKey: ['suburb-crime', salCode],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/suburbs/${salCode}/crime`)
            if (!res.ok) throw new Error('Failed to fetch suburb crime data.')
            return res.json()
        },
        enabled: !!salCode,
        staleTime: 5 * 60 * 1000,
        retry: 0,
    })
}

// Fetch tenure data for multiple suburbs by their salCodes
export function useSuburbTenureBatch(salCodes: string[]) {
    return useQuery<TenureResponse[]>({
        queryKey: ['suburb-tenure-batch', salCodes],
        queryFn: async () => {
            const params = new URLSearchParams()
            salCodes.forEach(code => params.append('salCodes', code))
            const res = await fetch(`${API_BASE}/api/suburbs/tenure/batch?${params}`)
            if (!res.ok) throw new Error('Failed to fetch batch tenure data.')
            return res.json()
        },
        enabled: salCodes.length > 0,
        staleTime: 5 * 60 * 1000
    })
}
import { useQuery, useQueries } from '@tanstack/react-query'
import type { SuburbSearchResult, TenureResponse, NearbySuburbsResponse, LanguageResponse, BirthCountryResponse, EducationResponse, CrimeResponse } from '../types/api'
import { supabase } from '../lib/supabase'

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

// —— PDF comparison report ——
// Gathers language / country-of-birth / education / crime for EVERY suburb in
// one place so the print-only <CompareReport> table can render its rows.
// Uses the same queryKeys / staleTime as the per-suburb hooks above, so it
// shares the TanStack cache with the on-screen sections — no extra network.
export interface CompareReportRow {
    tenure: TenureResponse
    language?: LanguageResponse
    birthCountry?: BirthCountryResponse
    education?: EducationResponse
    crime?: CrimeResponse
}

export function useCompareReport(
    salCodes: string[],
    tenure: TenureResponse[] | undefined,
) {
    const language = useQueries({
        queries: salCodes.map(code => ({
            queryKey: ['suburb-language', code],
            queryFn: async () => {
                const res = await fetch(`${API_BASE}/api/suburbs/${code}/language`)
                if (!res.ok) throw new Error('Failed to fetch suburb language data.')
                return res.json() as Promise<LanguageResponse>
            },
            enabled: !!code,
            staleTime: 5 * 60 * 1000,
        })),
    })

    const birthCountry = useQueries({
        queries: salCodes.map(code => ({
            queryKey: ['suburb-birthcountry', code],
            queryFn: async () => {
                const res = await fetch(`${API_BASE}/api/suburbs/${code}/birthcountry`)
                if (!res.ok) throw new Error('Failed to fetch suburb birth country data.')
                return res.json() as Promise<BirthCountryResponse>
            },
            enabled: !!code,
            staleTime: 5 * 60 * 1000,
            retry: 0,
        })),
    })

    const education = useQueries({
        queries: salCodes.map(code => ({
            queryKey: ['suburb-education', code],
            queryFn: async () => {
                const res = await fetch(`${API_BASE}/api/suburbs/${code}/education`)
                if (!res.ok) throw new Error('Failed to fetch suburb education data.')
                return res.json() as Promise<EducationResponse>
            },
            enabled: !!code,
            staleTime: 5 * 60 * 1000,
            retry: 0,
        })),
    })

    const crime = useQueries({
        queries: salCodes.map(code => ({
            queryKey: ['suburb-crime', code],
            queryFn: async () => {
                const res = await fetch(`${API_BASE}/api/suburbs/${code}/crime`)
                if (!res.ok) throw new Error('Failed to fetch suburb crime data.')
                return res.json() as Promise<CrimeResponse>
            },
            enabled: !!code,
            staleTime: 5 * 60 * 1000,
            retry: 0,  // Sydney suburbs 404 — treat as "no data", not a failure
        })),
    })

    // Align each tenure row to its side queries by salCode (the batch endpoint
    // does not guarantee the same order as the requested codes).
    const rows: CompareReportRow[] = (tenure ?? []).map(t => {
        const i = salCodes.indexOf(t.salCode)
        return {
            tenure: t,
            language: i >= 0 ? language[i]?.data : undefined,
            birthCountry: i >= 0 ? birthCountry[i]?.data : undefined,
            education: i >= 0 ? education[i]?.data : undefined,
            crime: i >= 0 ? crime[i]?.data : undefined,
        }
    })

    // Ready once every side query has settled (success OR error — a 404 crime
    // query is "settled", just empty). Guards against printing half-loaded rows.
    const isPending =
        language.some(q => q.isPending) ||
        birthCountry.some(q => q.isPending) ||
        education.some(q => q.isPending) ||
        crime.some(q => q.isPending)

    return { rows, isPending }
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

// —— 热门 suburb 计数（自建，写入 Supabase suburb_views）——
// GA4 的数据取不回前端，首页要读的"最近 30 天最热"只能存在自己库里。
// 写入不走 C# 后端（Dapper is query-only），前端直接打 Supabase，受 RLS 约束：
// suburb_views 只有 insert policy，原始流水读不出去；对外只暴露聚合视图。

// 同一会话同一 suburb 只记一次：既防自刷，也顺带挡掉 StrictMode 的双跑
// （先写 sessionStorage 再发请求，所以第二次同步调用直接被拦下）。
export async function recordSuburbView(salCode: string) {
    const key = `sv:${salCode}`
    if (sessionStorage.getItem(key)) {
        if (import.meta.env.DEV) console.log('[suburb_views] skipped, already recorded this tab:', salCode)
        return
    }
    sessionStorage.setItem(key, '1')

    try {
        if (import.meta.env.DEV) console.log('[suburb_views] inserting', salCode)
        const { error } = await supabase.from('suburb_views').insert({ sal_code: salCode })
        if (error) throw error
        if (import.meta.env.DEV) console.log('[suburb_views] ok', salCode)
    } catch (e) {
        // 还原标记：返回 error 和直接抛异常两条路都要走到，否则这个 suburb
        // 在本标签页里会被永久跳过，之后连请求都不再发。
        sessionStorage.removeItem(key)
        if (import.meta.env.DEV) console.warn('[suburb_views] insert failed:', e)
    }
}

export interface PopularSuburb {
    salCode: string
    salName: string
    stateName: string
    viewCount: number
}

export function usePopularSuburbs(limit = 8) {
    return useQuery<PopularSuburb[]>({
        queryKey: ['popular-suburbs', limit],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_popular_suburbs')
                .select('sal_code, sal_name, state_name, view_count')
                .order('view_count', { ascending: false })
                .limit(limit)
            if (error) throw error
            // Supabase 直读拿到的是 snake_case，在边界上转成项目约定的 camelCase
            return (data ?? []).map(r => ({
                salCode: r.sal_code as string,
                salName: r.sal_name as string,
                stateName: r.state_name as string,
                viewCount: r.view_count as number,
            }))
        },
        staleTime: 5 * 60 * 1000,
        retry: 0,  // 表是空的 / 视图没建好都不值得重试，首页静默跳过
    })
}
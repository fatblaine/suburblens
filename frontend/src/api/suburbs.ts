import { useQuery, useQueries } from '@tanstack/react-query'
import type { SuburbSearchResult, TenureResponse, NearbySuburbsResponse, PoiDistancesResponse, LanguageResponse, BirthCountryResponse, EducationResponse, CrimeResponse } from '../types/api'
import { supabase } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// Shared fetch → throw-on-error → json. `errorMsg` surfaces in the query's
// error state; every JSON endpoint goes through here so the fetch/ok/parse
// boilerplate lives in exactly one place.
async function fetchJson<T>(url: string, errorMsg = 'Request failed'): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(errorMsg)
    return res.json() as Promise<T>
}

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

// —— 每个 suburb 的人口画像查询（language / birthcountry / education / crime）——
// 这四个 hook 形状一致，唯一区别是路径、错误文案、以及是否重试（404 = 该 suburb
// 无数据，属预期，不该重试）。工厂统一生成 TanStack 查询选项，queryKey 与下方
// 屏幕上各 section 完全一致，从而共享同一份缓存（PDF 报表不会多打一次网络）。
type ProfileKind = 'language' | 'birthcountry' | 'education' | 'crime'

const PROFILE: Record<ProfileKind, { path: string; error: string; retry?: number }> = {
    language:     { path: 'language',     error: 'Failed to fetch suburb language data.' },
    birthcountry: { path: 'birthcountry', error: 'Failed to fetch suburb birth country data.', retry: 0 },
    education:    { path: 'education',     error: 'Failed to fetch suburb education data.', retry: 0 },
    crime:        { path: 'crime',         error: 'Failed to fetch suburb crime data.', retry: 0 },
}

function profileQuery<T>(kind: ProfileKind, salCode: string | undefined) {
    const meta = PROFILE[kind]
    return {
        queryKey: [`suburb-${kind}`, salCode],
        queryFn: () => fetchJson<T>(`${API_BASE}/api/suburbs/${salCode}/${meta.path}`, meta.error),
        enabled: !!salCode,
        staleTime: 5 * 60 * 1000,
        ...(meta.retry !== undefined ? { retry: meta.retry } : {}),
    }
}

// Search for suburbs by name
export function useSuburbSearch(query: string) {
    return useQuery<SuburbSearchResult[]>({
        queryKey: ['suburbSearch', query],
        queryFn: async () => {
            try {
                return await fetchJson<SuburbSearchResult[]>(
                    `${API_BASE}/api/suburbs/search?q=${encodeURIComponent(query)}`,
                    'Failed to search suburbs.',
                )
            } finally {
                markRequest()  // 请求打到了 Lambda（成功或失败都算唤醒），刷新时间戳
            }
        },
        enabled: query.trim().length >= 2,
        staleTime: 5 * 60 * 1000
    })
}

// Fetch tenure data for a suburb by its salCode
export function useSuburbTenure(salCode: string | undefined) {
    return useQuery<TenureResponse>({
        queryKey: ['suburb-tenure', salCode],
        queryFn: () => fetchJson<TenureResponse>(`${API_BASE}/api/suburbs/${salCode}/tenure`, 'Failed to fetch suburb tenure data.'),
        enabled: !!salCode,
        staleTime: 5 * 60 * 1000
    })
}

// Fetch nearby suburbs for a given salCode
// enabled 参数由外部控制，只有用户点了按钮才传 true 触发请求
export function useNearbySuburbs(salCode: string | undefined, limit = 5, enabled = false) {
    return useQuery<NearbySuburbsResponse>({
        queryKey: ['nearby', salCode, limit],  // 不同 salCode 各自缓存
        queryFn: () => fetchJson<NearbySuburbsResponse>(`${API_BASE}/api/suburbs/${salCode}/nearby?limit=${limit}`, 'Failed to fetch nearby suburbs.'),
        enabled: !!salCode && enabled,  // salCode 存在 且 用户已展开，才发请求
        staleTime: 10 * 60 * 1000  // 地理数据不变，缓存 10 分钟
    })
}

// Fetch straight-line distances from a suburb to key POIs (universities + CBD).
// Geographic data is static, so cache it long like nearby.
export function useSuburbDistances(salCode: string | undefined) {
    return useQuery<PoiDistancesResponse>({
        queryKey: ['distances', salCode],
        queryFn: () => fetchJson<PoiDistancesResponse>(`${API_BASE}/api/suburbs/${salCode}/distances`, 'Failed to fetch suburb distances.'),
        enabled: !!salCode,
        staleTime: 10 * 60 * 1000,
        retry: 0,  // 404 = out of scope, not worth retrying
    })
}

// Fetch language profile for a suburb by its salCode
export function useSuburbLanguage(salCode: string | undefined) {
    return useQuery<LanguageResponse>(profileQuery<LanguageResponse>('language', salCode))
}

// Fetch country of birth profile for a suburb by its salCode
export function useSuburbBirthCountry(salCode: string | undefined) {
    return useQuery<BirthCountryResponse>(profileQuery<BirthCountryResponse>('birthcountry', salCode))
}

// Fetch education level profile for a suburb by its salCode
export function useSuburbEducation(salCode: string | undefined) {
    return useQuery<EducationResponse>(profileQuery<EducationResponse>('education', salCode))
}

// Fetch recorded crime incidents for a suburb (Greater Melbourne only; 404 elsewhere)
export function useSuburbCrime(salCode: string | undefined) {
    return useQuery<CrimeResponse>(profileQuery<CrimeResponse>('crime', salCode))
}

// —— PDF comparison report ——
// Gathers language / country-of-birth / education / crime for EVERY suburb in
// one place so the print-only <CompareReport> table can render its rows.
// Uses the same queryKeys / staleTime as the per-suburb hooks above (via the
// shared profileQuery factory), so it shares the TanStack cache with the
// on-screen sections — no extra network.
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
        queries: salCodes.map(code => profileQuery<LanguageResponse>('language', code)),
    })
    const birthCountry = useQueries({
        queries: salCodes.map(code => profileQuery<BirthCountryResponse>('birthcountry', code)),
    })
    const education = useQueries({
        queries: salCodes.map(code => profileQuery<EducationResponse>('education', code)),
    })
    const crime = useQueries({
        queries: salCodes.map(code => profileQuery<CrimeResponse>('crime', code)),
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
        queryFn: () => {
            const params = new URLSearchParams()
            salCodes.forEach(code => params.append('salCodes', code))
            return fetchJson<TenureResponse[]>(`${API_BASE}/api/suburbs/tenure/batch?${params}`, 'Failed to fetch batch tenure data.')
        },
        enabled: salCodes.length > 0,
        staleTime: 5 * 60 * 1000
    })
}

// —— 全量 suburb 列表（用于 /suburbs 索引页）——
// 复用 /api/suburbs/heatmap：不带 city 参数即返回悉尼+墨尔本全部，且已在 Redis
// + 浏览器 Cache-Control 里缓存。这里只取 feature 的 properties（名字/城市），
// 丢掉几何，交给索引页按城市 + 首字母 A–Z 分组渲染成内链。
export interface SuburbListEntry {
    salCode: string
    salName: string
    gccsaCode: string
    stateName: string
}

export function useAllSuburbs() {
    return useQuery<SuburbListEntry[]>({
        queryKey: ['all-suburbs'],
        queryFn: async () => {
            const geojson = await fetchJson<{ features?: Array<{ properties?: Record<string, unknown> }> }>(
                `${API_BASE}/api/suburbs/heatmap`,
                'Failed to load the suburb list.',
            )
            return (geojson.features ?? []).map(f => ({
                salCode: String(f.properties?.salCode ?? ''),
                salName: String(f.properties?.salName ?? ''),
                gccsaCode: String(f.properties?.gccsaCode ?? ''),
                stateName: String(f.properties?.stateName ?? ''),
            }))
        },
        staleTime: 30 * 60 * 1000,  // 静态数据，缓存久一点
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

// 和搜索结果同形，这样首页可以把一个 pill 直接当成"搜到并选中"来处理
export interface PopularSuburb extends SuburbSearchResult {
    viewCount: number
}

export function usePopularSuburbs(limit = 8) {
    return useQuery<PopularSuburb[]>({
        queryKey: ['popular-suburbs', limit],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_popular_suburbs')
                .select('sal_code, sal_name, state_name, gccsa_name, view_count')
                .order('view_count', { ascending: false })
                .limit(limit)
            if (error) throw error
            // Supabase 直读拿到的是 snake_case，在边界上转成项目约定的 camelCase
            return (data ?? []).map(r => ({
                salCode: r.sal_code as string,
                salName: r.sal_name as string,
                stateName: r.state_name as string,
                gccsaName: r.gccsa_name as string,
                viewCount: r.view_count as number,
            }))
        },
        staleTime: 5 * 60 * 1000,
        retry: 0,  // 表是空的 / 视图没建好都不值得重试，首页静默跳过
    })
}

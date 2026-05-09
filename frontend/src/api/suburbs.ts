import { useQuery } from '@tanstack/react-query'
import type { SuburbSearchResult, TenureResponse, NearbySuburbsResponse } from '../types/api'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// Search for suburbs by name
export function useSuburbSearch(query: string) {
    return useQuery<SuburbSearchResult[]>({
        queryKey: ['suburbSearch', query],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/suburbs/search?q=${encodeURIComponent(query)}`)
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
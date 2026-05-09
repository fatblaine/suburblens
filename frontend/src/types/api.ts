// Nearby suburbs — matches GET /api/suburbs/:salCode/nearby
export interface NearbySuburb {
  salCode: string
  salName: string
  stateName: string
  gccsaName: string
  distanceMeters: number
}

export interface NearbySuburbsResponse {
  suburb: { salCode: string; salName: string }
  nearby: NearbySuburb[]
}

// Suburb search result — matches GET /api/suburbs/search
export interface SuburbSearchResult {
  salCode: string
  salName: string
  stateName: string
  gccsaName: string
}

// Tenure time machine — matches GET /api/suburbs/:salCode/tenure
export interface YearValues {
  y2011: number | null
  y2016: number | null
  y2021: number | null
}

export interface YearCounts {
  y2011: number | null
  y2016: number | null
  y2021: number | null
}

export interface TenureByYear {
  outright: YearValues
  mortgage: YearValues
  rent: YearValues
  totalDwellings: YearCounts
}

export interface TenureResponse {
  salCode: string
  salName: string
  stateName: string
  gccsaName: string
  sa2Code: string
  sa2Name: string
  tenure: TenureByYear
  residencyShiftIndex: number | null
  trendLabel: string
  dataNote: string
}

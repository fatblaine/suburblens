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

// Country of birth — matches GET /api/suburbs/:salCode/birthcountry
export interface CountryEntry {
  country: string
  pct: number | null
}

export interface BirthCountryYearData {
  totalPersons: number | null
  countries: CountryEntry[]
}

export interface BirthCountryResponse {
  salCode: string
  salName: string
  stateName: string
  gccsaName: string
  sa2Code: string
  sa2Name: string
  y2011: BirthCountryYearData | null
  y2016: BirthCountryYearData | null
  y2021: BirthCountryYearData | null
  dataNote: string
}

// Education level — matches GET /api/suburbs/:salCode/education
export interface EducationLevel {
  label: string
  pct: number | null
}

export interface EducationYearData {
  totalPersons: number | null
  universityPct: number | null
  levels: EducationLevel[]
}

export interface EducationResponse {
  salCode: string
  salName: string
  stateName: string
  gccsaName: string
  sa2Code: string
  sa2Name: string
  y2011: EducationYearData | null
  y2016: EducationYearData | null
  y2021: EducationYearData | null
  dataNote: string
}

// Language at home — matches GET /api/suburbs/:salCode/language
export interface LanguageEntry {
  language: string
  pct: number | null
}

export interface LanguageYearData {
  totalPersons: number | null
  languages: LanguageEntry[]  // sorted by pct desc, pct > 0 only
}

export interface LanguageResponse {
  salCode: string
  salName: string
  stateName: string
  gccsaName: string
  sa2Code: string
  sa2Name: string
  y2011: LanguageYearData | null
  y2016: LanguageYearData | null
  y2021: LanguageYearData | null
  dataNote: string
}

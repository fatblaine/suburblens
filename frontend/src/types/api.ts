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

// POI straight-line distances — matches GET /api/suburbs/:salCode/distances
export interface PoiDistance {
  code: string
  name: string
  shortName?: string
  category: 'university' | 'cbd'
  distanceMeters: number
}

export interface PoiDistancesResponse {
  salCode: string
  distances: PoiDistance[]
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

export interface EducationBenchmark {
  universityPct: number    // this suburb's latest-year university-qualified share
  percentileRank: number   // 0..1, share of same-city suburbs it exceeds
  medianPct: number        // cohort median for the same year
  cohortMax: number        // most-qualified suburb's share that year
  cohortCount: number      // suburbs in the cohort
  cohortName: string       // "Greater Sydney" | "Greater Melbourne"
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
  benchmark: EducationBenchmark | null
  dataNote: string
}

// Housing mix — matches GET /api/suburbs/:salCode/housing-mix
export interface HousingMix {
  separateHouses: number
  semiDetachedTownhouses: number
  apartments: number
  otherDwellings: number
  structureNotStated: number
  totalOccupiedPrivateDwellings: number
  apartmentsPer100Houses: number | null
  apartmentSharePct: number | null
  townhouseSharePct: number | null
  cityMedianApartmentsPer100Houses: number | null
  attachedDwellings: number
  attachedDwellingsPer100Houses: number | null
  cityMedianAttachedDwellingsPer100Houses: number | null
}

export interface HousingMixResponse {
  salCode: string
  salName: string
  stateName: string
  gccsaName: string
  censusYear: number
  housing: HousingMix
  dataNote: string
}

// Crime — matches GET /api/suburbs/:salCode/crime  (Greater Melbourne only; 404 elsewhere)
export interface CrimeCategory {
  category: string   // assault | break_enter | theft | robbery | property_damage | other
  incidents: number
}

export interface CrimePeriod {
  yearEnding: number
  total: number
  categories: CrimeCategory[]  // sorted by incidents desc
}

export interface CrimeBenchmark {
  total: number            // this suburb's latest-year total (== latest period total)
  percentileRank: number   // 0..1, share of Greater Melbourne suburbs it exceeds
  medianTotal: number      // cohort median for the same year
  cohortMax: number        // busiest suburb's total that year
  cohortCount: number      // suburbs in the cohort
}

export interface CrimeResponse {
  salCode: string
  salName: string
  stateName: string
  gccsaName: string
  periods: CrimePeriod[]       // ascending by yearEnding
  benchmark: CrimeBenchmark | null
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

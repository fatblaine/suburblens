import type {
  TenureResponse,
  LanguageResponse,
  BirthCountryResponse,
  EducationResponse,
  CrimeResponse,
} from '../types/api'

// Data-driven editorial prose for a single suburb. Kept framework-free so the
// same function can back both the React <SuburbNarrative> component and the
// prerender script (adsense-plan §8.5.1 / §8.5.6 step 7) — one source of truth,
// no drift between what a user sees and what a crawler reads.
//
// Anti-template guard (§8.5.7): verbs and framing switch on numeric bands, so
// two suburbs with different numbers read differently rather than swapping only
// the place name — the difference between original content and scaled filler.

export interface NarrativeInput {
  tenure: TenureResponse
  language?: LanguageResponse | null
  birthCountry?: BirthCountryResponse | null
  education?: EducationResponse | null
  crime?: CrimeResponse | null
}

export interface Narrative {
  paragraphs: string[]
  source: string
}

const round = (n: number) => Math.round(n)
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`

// Verb chosen by the size of a percentage-point move, direction preserved.
function moveVerb(delta: number): string {
  const a = Math.abs(delta)
  if (a < 1) return 'barely changed'
  if (delta > 0) {
    if (a < 3) return 'edged up'
    if (a < 6) return 'rose'
    if (a < 12) return 'climbed'
    return 'surged'
  }
  if (a < 3) return 'edged down'
  if (a < 6) return 'fell'
  if (a < 12) return 'dropped'
  return 'fell sharply'
}

const TREND_PHRASE: Record<string, string> = {
  strong_ownership_shift: 'a strong shift toward owner-occupation',
  mild_ownership_shift: 'a gradual shift toward owner-occupation',
  stable: 'a broadly stable tenure mix',
  mild_rental_shift: 'a gradual shift toward renting',
  strong_rental_shift: 'a pronounced shift toward renting',
}

// Paragraph 1 — the tenure trend and the custom Residency Shift Index.
function tenurePara(t: TenureResponse): string {
  const trend = TREND_PHRASE[t.trendLabel] ?? 'a mixed tenure trend'
  const idx = t.residencyShiftIndex
  const idxSentence =
    idx != null
      ? ` Its Residency Shift Index — a SuburbLens custom heuristic weighing the most recent shift — scores ${signed(idx)}, marking ${trend}.`
      : ` SuburbLens reads its recent trend as ${trend}.`

  const r2011 = t.tenure.rent.y2011
  const r2021 = t.tenure.rent.y2021
  if (r2011 != null && r2021 != null) {
    const delta = r2021 - r2011
    return (
      `Between the 2011 and 2021 Censuses, the share of rented homes in ${t.salName} ${moveVerb(delta)} ` +
      `from ${round(r2011)}% to ${round(r2021)}% (${signed(delta)} points).${idxSentence}`
    )
  }
  return `${t.salName}'s tenure mix is tracked across the 2011, 2016 and 2021 Censuses.${idxSentence}`
}

// Paragraph 2 — who lives here: overseas-born share, top origin, languages.
function communityPara(
  salName: string,
  language?: LanguageResponse | null,
  birth?: BirthCountryResponse | null,
): string | null {
  const sentences: string[] = []

  const b = birth ? birth.y2021 ?? birth.y2016 ?? birth.y2011 : null
  if (b && b.countries.length) {
    const au = b.countries.find(c => /^australia$/i.test(c.country))
    const overseas = au?.pct != null ? 100 - au.pct : null
    const topForeign = b.countries.find(c => !/^australia$/i.test(c.country) && c.pct != null)
    if (overseas != null && topForeign) {
      const flavour =
        overseas >= 45 ? 'strongly international' : overseas >= 28 ? 'notably diverse' : 'largely Australian-born'
      sentences.push(
        `The community is ${flavour}: around ${round(overseas)}% of residents were born overseas, most often in ${topForeign.country}.`,
      )
    } else if (topForeign) {
      sentences.push(`Its largest overseas-born group comes from ${topForeign.country}.`)
    }
  }

  const l = language ? language.y2021 ?? language.y2016 ?? language.y2011 : null
  if (l && l.languages.length) {
    const nonEnglish = l.languages
      .filter(x => !/^english/i.test(x.language) && x.pct != null)
      .slice(0, 3)
      .map(x => x.language)
    if (nonEnglish.length) {
      const list =
        nonEnglish.length === 1
          ? nonEnglish[0]
          : `${nonEnglish.slice(0, -1).join(', ')} and ${nonEnglish[nonEnglish.length - 1]}`
      sentences.push(`Beyond English, the languages most spoken at home in ${salName} are ${list}.`)
    }
  }

  return sentences.length ? sentences.join(' ') : null
}

// Paragraph 3 — education, and crime for Melbourne suburbs only.
function outcomesPara(education?: EducationResponse | null, crime?: CrimeResponse | null): string | null {
  const sentences: string[] = []

  const e = education ? education.y2021 ?? education.y2016 ?? education.y2011 : null
  const uni = e?.universityPct
  if (uni != null) {
    const bench = education?.benchmark
    if (bench && bench.medianPct != null) {
      const rel = uni >= bench.medianPct ? 'above' : 'below'
      const ahead = round(bench.percentileRank * 100)
      sentences.push(
        `University-qualified residents (a bachelor degree or higher) make up ${round(uni)}%, ${rel} the ${bench.cohortName} median of ${round(bench.medianPct)}% and ahead of ${ahead}% of suburbs in the city.`,
      )
    } else {
      sentences.push(`University-qualified residents (a bachelor degree or higher) make up ${round(uni)}%.`)
    }
  }

  // Crime is Greater Melbourne only; if there is no data (e.g. a Sydney suburb),
  // say nothing rather than invent it.
  const latest = crime?.periods?.length ? crime.periods[crime.periods.length - 1] : null
  if (latest) {
    const cb = crime?.benchmark
    if (cb && cb.percentileRank != null) {
      const ahead = round(cb.percentileRank * 100)
      sentences.push(
        `Recorded criminal incidents totalled ${latest.total.toLocaleString()} in the latest year — higher than ${ahead}% of Greater Melbourne suburbs, though this ranks by volume rather than a per-person rate.`,
      )
    } else {
      sentences.push(`Recorded criminal incidents totalled ${latest.total.toLocaleString()} in the latest year.`)
    }
  }

  return sentences.length ? sentences.join(' ') : null
}

export function buildNarrative(input: NarrativeInput): Narrative {
  const { tenure, language, birthCountry, education, crime } = input

  const paragraphs = [
    tenurePara(tenure),
    communityPara(tenure.salName, language, birthCountry),
    outcomesPara(education, crime),
  ].filter((p): p is string => p != null)

  const source =
    `Source: ABS Census 2021 (TSP), SA2 “${tenure.sa2Name}”.` +
    (crime?.periods?.length ? ' Crime: Victoria Crime Statistics Agency.' : '')

  return { paragraphs, source }
}

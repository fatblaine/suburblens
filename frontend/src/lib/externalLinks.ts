// Outbound links to the property portals' sold-listing pages.
//
// SuburbLens deliberately holds no sale price data — Census price fields are stale by
// design (see docs/planning/SuburbLens_MVP_Plan_Fina.md section 1.2), so the honest answer
// to "what did homes here sell for?" is a link, not a number of ours.
//
// Every portal addresses a suburb the same way — name, state, postcode — but with
// different separators, so each URL is built explicitly rather than from one template.

export type SoldSite = 'realestate' | 'domain' | 'homely'

export interface SoldLink {
  site: SoldSite
  label: string
  url: string
}

export interface SoldLinkInput {
  salName: string
  stateName: string
  postcode: string | null | undefined
}

// ABS appends a disambiguator to suburb names that repeat across states or councils:
// 'Carlton (Vic.)', 'Bellfield (Banyule - Vic.)', 'Glebe (NSW)'. The portals know the
// bare name only. Same regex the browser extension uses (extension/src/background.js).
const DISAMBIGUATOR = /\s*\(.*\)\s*$/

// Only Greater Sydney and Greater Melbourne are in scope, so two entries is the whole
// map — an unknown state returns null rather than guessing at an abbreviation.
const STATE_ABBREV: Record<string, string> = {
  'New South Wales': 'nsw',
  Victoria: 'vic',
}

/** 'Carlton (Vic.)' → 'Carlton'. */
export function baseName(salName: string): string {
  return salName.replace(DISAMBIGUATOR, '').trim()
}

/** 'New South Wales' → 'nsw'. Null for anything outside the two supported states. */
export function stateAbbrev(stateName: string): string | null {
  return STATE_ABBREV[stateName.trim()] ?? null
}

/** Lowercase the name and join its words with `separator`. */
function slug(name: string, separator: string): string {
  return baseName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .join(separator)
}

/**
 * Sold-listing links for a suburb, or [] when we cannot address it precisely.
 *
 * Returning [] rather than a best guess is deliberate: a link built without a postcode
 * lands on the wrong suburb wherever a name repeats, and a broken link costs more trust
 * than a missing card.
 */
export function soldLinks({ salName, stateName, postcode }: SoldLinkInput): SoldLink[] {
  const state = stateAbbrev(stateName)
  if (!state || !postcode || !/^\d{4}$/.test(postcode)) return []

  const plus = slug(salName, '+')     // realestate.com.au: 'st+kilda'
  const dash = slug(salName, '-')     // domain + homely:   'st-kilda'
  if (!plus || !dash) return []

  return [
    {
      site: 'realestate',
      label: 'realestate.com.au',
      url:
        `https://www.realestate.com.au/sold/in-${plus},+${state}+${postcode}/list-1` +
        '?includeSurrounding=false&activeSort=relevance',
    },
    {
      site: 'domain',
      label: 'Domain',
      url:
        `https://www.domain.com.au/sold-listings/${dash}-${state}-${postcode}/` +
        '?excludepricewithheld=1&ssubs=0',
    },
    {
      site: 'homely',
      label: 'Homely',
      url: `https://www.homely.com.au/sold-properties/${dash}-${state}-${postcode}?surrounding=false`,
    },
  ]
}

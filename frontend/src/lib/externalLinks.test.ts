import { describe, it, expect } from 'vitest'
import { baseName, stateAbbrev, soldLinks } from './externalLinks'

const ultimo = { salName: 'Ultimo', stateName: 'New South Wales', postcode: '2007' }

describe('baseName', () => {
  it('strips the ABS disambiguation suffix', () => {
    expect(baseName('Carlton (Vic.)')).toBe('Carlton')
    expect(baseName('Bellfield (Banyule - Vic.)')).toBe('Bellfield')
    expect(baseName('Glebe (NSW)')).toBe('Glebe')
  })

  it('leaves a plain name untouched', () => {
    expect(baseName('Ultimo')).toBe('Ultimo')
  })
})

describe('stateAbbrev', () => {
  it('maps the two supported states', () => {
    expect(stateAbbrev('New South Wales')).toBe('nsw')
    expect(stateAbbrev('Victoria')).toBe('vic')
  })

  it('returns null rather than guessing for an out-of-scope state', () => {
    expect(stateAbbrev('Queensland')).toBeNull()
  })
})

describe('soldLinks', () => {
  it('builds all three portal URLs', () => {
    const links = soldLinks(ultimo)
    expect(links.map(l => l.site)).toEqual(['realestate', 'domain', 'homely'])
    expect(links[0].url).toBe(
      'https://www.realestate.com.au/sold/in-ultimo,+nsw+2007/list-1' +
        '?includeSurrounding=false&activeSort=relevance',
    )
    expect(links[1].url).toBe(
      'https://www.domain.com.au/sold-listings/ultimo-nsw-2007/?excludepricewithheld=1&ssubs=0',
    )
    expect(links[2].url).toBe(
      'https://www.homely.com.au/sold-properties/ultimo-nsw-2007?surrounding=false',
    )
  })

  it('separates multi-word suburbs per portal: + for realestate, - for the others', () => {
    const links = soldLinks({ salName: 'St Kilda', stateName: 'Victoria', postcode: '3182' })
    expect(links[0].url).toContain('/sold/in-st+kilda,+vic+3182/')
    expect(links[1].url).toContain('/sold-listings/st-kilda-vic-3182/')
    expect(links[2].url).toContain('/sold-properties/st-kilda-vic-3182?')
  })

  it('drops the disambiguation suffix the portals do not know about', () => {
    const links = soldLinks({ salName: 'Carlton (Vic.)', stateName: 'Victoria', postcode: '3053' })
    expect(links[0].url).toContain('/sold/in-carlton,+vic+3053/')
    expect(links[0].url).not.toContain('(')
  })

  // A link built without a postcode silently lands on a same-named suburb interstate,
  // so the card must disappear instead.
  it('returns nothing without a usable postcode', () => {
    expect(soldLinks({ ...ultimo, postcode: null })).toEqual([])
    expect(soldLinks({ ...ultimo, postcode: '' })).toEqual([])
    expect(soldLinks({ ...ultimo, postcode: 'ZZZZ' })).toEqual([])
  })

  it('returns nothing for a state outside Sydney and Melbourne', () => {
    expect(soldLinks({ salName: 'Fortitude Valley', stateName: 'Queensland', postcode: '4006' }))
      .toEqual([])
  })
})

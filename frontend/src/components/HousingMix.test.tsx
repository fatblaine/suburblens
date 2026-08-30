import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import HousingMix from './HousingMix'
import type { HousingMixResponse } from '../types/api'


const response: HousingMixResponse = {
  salCode: '11703',
  salName: 'Glebe',
  stateName: 'New South Wales',
  gccsaName: 'Greater Sydney',
  censusYear: 2021,
  housing: {
    separateHouses: 420,
    semiDetachedTownhouses: 310,
    apartments: 825,
    otherDwellings: 5,
    structureNotStated: 0,
    totalOccupiedPrivateDwellings: 1560,
    apartmentsPer100Houses: 196.4,
    apartmentSharePct: 52.9,
    townhouseSharePct: 19.9,
    cityMedianApartmentsPer100Houses: 34.1,
    attachedDwellings: 1135,
    attachedDwellingsPer100Houses: 270.2,
    cityMedianAttachedDwellingsPer100Houses: 48.7,
  },
  dataNote: '2021 ABS Census General Community Profile.',
}

describe('HousingMix', () => {
  it('renders the headline, city benchmark, and accessible composition summary', () => {
    render(<HousingMix response={response} />)

    expect(screen.getByText('270.2')).toBeInTheDocument()
    expect(screen.getByText(/48.7 per 100 separate houses/)).toBeInTheDocument()
    expect(screen.getByText(/196.4 apartments per 100 separate houses/)).toBeInTheDocument()
    expect(screen.getByText(/Attached dwellings: 1,135/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Separate houses 26.9%/ })).toBeInTheDocument()
  })

  it('uses the no-house fallback instead of Infinity', () => {
    render(
      <HousingMix
        response={{
          ...response,
          housing: {
            ...response.housing,
            separateHouses: 0,
            apartmentsPer100Houses: null,
            attachedDwellingsPer100Houses: null,
          },
        }}
      />,
    )

    expect(screen.getByText('No separate houses')).toBeInTheDocument()
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument()
  })
})

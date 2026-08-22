import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import CompareReport from './CompareReport'
import type { CompareReportRow } from '../api/suburbs'


const row: CompareReportRow = {
  tenure: {
    salCode: '11703',
    salName: 'Glebe',
    stateName: 'New South Wales',
    gccsaName: 'Greater Sydney',
    sa2Code: '117031336',
    sa2Name: 'Glebe - Forest Lodge',
    tenure: {
      outright: { y2011: 20, y2016: 19, y2021: 18 },
      mortgage: { y2011: 30, y2016: 29, y2021: 28 },
      rent: { y2011: 50, y2016: 52, y2021: 54 },
      totalDwellings: { y2011: 1400, y2016: 1500, y2021: 1560 },
    },
    residencyShiftIndex: -2.4,
    trendLabel: 'mild_rental_shift',
    dataNote: 'ABS SA2 data.',
  },
  housingMix: {
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
  },
}

describe('CompareReport', () => {
  it('includes the SAL-level housing mix metrics and limitation note', () => {
    render(<CompareReport rows={[row]} />)

    expect(screen.getByText('Housing mix · 2021 · SAL')).toBeInTheDocument()
    expect(screen.getByText('Attached dwellings / 100 houses')).toBeInTheDocument()
    expect(screen.getByText('270.2')).toBeInTheDocument()
    expect(screen.getByText('52.9%')).toBeInTheDocument()
    expect(screen.getByText(/not an investment recommendation/i)).toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ShiftIndexCard from './ShiftIndexCard'

describe('ShiftIndexCard', () => {
  it('renders the label and description for a known trend', () => {
    render(<ShiftIndexCard residencyShiftIndex={7.2} trendLabel="strong_rental_shift" />)
    expect(screen.getByText('Strong Rental Shift')).toBeInTheDocument()
    expect(screen.getByText(/absorbed by investors/i)).toBeInTheDocument()
  })

  it('formats the index to one decimal place', () => {
    render(<ShiftIndexCard residencyShiftIndex={3.456} trendLabel="stable" />)
    expect(screen.getByText('3.5')).toBeInTheDocument()
  })

  it('shows "--" when the index is null', () => {
    render(<ShiftIndexCard residencyShiftIndex={null} trendLabel="stable" />)
    expect(screen.getByText('--')).toBeInTheDocument()
  })

  it('falls back to the Stable style for an unknown trend label', () => {
    // An unexpected trendLabel from the API must not blow up — it renders Stable.
    render(<ShiftIndexCard residencyShiftIndex={0} trendLabel={'nonsense' as never} />)
    expect(screen.getByText('Stable')).toBeInTheDocument()
  })

  // Project constraint (CLAUDE.md): the Residency Shift Index must always be
  // labelled "SuburbLens Custom" so it is never mistaken for an official figure.
  it('always labels the index as SuburbLens Custom', () => {
    render(<ShiftIndexCard residencyShiftIndex={1} trendLabel="mild_ownership_shift" />)
    expect(screen.getByText(/SuburbLens Custom/)).toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TabDeck from './TabDeck'
import { nearestIndex } from '../lib/nearestIndex'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'housing', label: 'Housing' },
  { key: 'crime', label: 'Crime' },
]

describe('nearestIndex', () => {
  it('picks the panel whose centre is closest', () => {
    const centers = [150, 450, 750]
    expect(nearestIndex(centers, 150)).toBe(0)
    expect(nearestIndex(centers, 470)).toBe(1)
    expect(nearestIndex(centers, 900)).toBe(2)
  })

  it('resolves a point exactly between two panels to the earlier one', () => {
    expect(nearestIndex([100, 300], 200)).toBe(0)
  })

  it('does not drift when panels are narrower than the track', () => {
    // 90%-wide panels with a gap: centres advance by less than the track width,
    // which is exactly where round(scrollLeft / trackWidth) would go wrong.
    const centers = [180, 470, 760, 1050]
    expect(nearestIndex(centers, 1050)).toBe(3)
  })
})

describe('TabDeck', () => {
  const renderDeck = (active: number) =>
    render(
      <TabDeck
        tabs={TABS}
        active={active}
        onSelect={vi.fn()}
        idPrefix="SAL12345"
        renderPanel={key => <p>panel {key}</p>}
      />,
    )

  it('renders every panel, not only the active one', () => {
    renderDeck(0)
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3)
    expect(screen.getByText('panel crime')).toBeInTheDocument()
  })

  it('marks exactly the inactive panels inert', () => {
    renderDeck(1)
    const panels = screen.getAllByRole('tabpanel', { hidden: true })
    expect(panels.map(p => p.hasAttribute('inert'))).toEqual([true, false, true])
  })

  it('namespaces panel ids so stacked cards do not collide', () => {
    renderDeck(0)
    const [first] = screen.getAllByRole('tabpanel', { hidden: true })
    expect(first).toHaveAttribute('id', 'SAL12345-panel-overview')
    expect(first).toHaveAttribute('aria-labelledby', 'SAL12345-tab-overview')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TabStrip from './TabStrip'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'housing', label: 'Housing' },
  { key: 'crime', label: 'Crime' },
]

function setup(active = 0) {
  const onSelect = vi.fn()
  render(<TabStrip tabs={TABS} active={active} onSelect={onSelect} idPrefix="SAL12345" />)
  return { onSelect }
}

describe('TabStrip', () => {
  it('exposes the pills as a tablist with one selected tab', () => {
    setup(1)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
  })

  it('points each tab at its panel', () => {
    setup()
    expect(screen.getByRole('tab', { name: 'Housing' }))
      .toHaveAttribute('aria-controls', 'SAL12345-panel-housing')
  })

  it('keeps only the active tab in the tab order', () => {
    setup(2)
    expect(screen.getAllByRole('tab').map(t => t.getAttribute('tabindex')))
      .toEqual(['-1', '-1', '0'])
  })

  it('selects on click', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByRole('tab', { name: 'Crime' }))
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('moves with the arrow keys, wrapping at both ends', () => {
    const { onSelect } = setup(2)
    const tab = screen.getByRole('tab', { name: 'Crime' })
    fireEvent.keyDown(tab, { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith(0)

    onSelect.mockClear()
    fireEvent.keyDown(tab, { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('jumps to the ends with Home and End', () => {
    const { onSelect } = setup(1)
    const tab = screen.getByRole('tab', { name: 'Housing' })
    fireEvent.keyDown(tab, { key: 'End' })
    expect(onSelect).toHaveBeenCalledWith(2)

    onSelect.mockClear()
    fireEvent.keyDown(tab, { key: 'Home' })
    expect(onSelect).toHaveBeenCalledWith(0)
  })
})

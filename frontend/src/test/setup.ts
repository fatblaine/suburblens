// Adds jest-dom matchers (toBeInTheDocument, toHaveTextContent, ...) to
// vitest's expect. The /vitest entry extends vitest's expect instance directly,
// so it works without enabling globals. Loaded once via vitest.config setupFiles.
import '@testing-library/jest-dom/vitest'

// Unmount rendered components after every test. RTL only auto-registers this
// when `globals` is on; we keep globals off, so wire cleanup explicitly —
// otherwise renders accumulate in the same DOM and getByText finds duplicates.
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom implements neither of these, and both are load-bearing for the tab deck
// and strip (Element.scrollTo since the strip auto-centres its active pill).
// No-ops are enough: every layout read in that code is guarded against the 0
// widths jsdom reports anyway.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

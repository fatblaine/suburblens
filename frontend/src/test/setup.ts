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

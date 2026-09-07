/**
 * Which panel is closest to the middle of the viewport, by centre point.
 *
 * Not `round(scrollLeft / trackWidth)`: panels sit in a track that is wider than
 * they are, so that ratio drifts further out of step with every tab.
 *
 * Lives here rather than in TabDeck.tsx so that file only exports a component —
 * a mixed export breaks React Fast Refresh, and eslint fails the build on it.
 */
export function nearestIndex(centers: number[], trackCenter: number): number {
  let best = 0
  let bestGap = Infinity
  centers.forEach((c, i) => {
    const gap = Math.abs(c - trackCenter)
    if (gap < bestGap) {
      bestGap = gap
      best = i
    }
  })
  return best
}

// Thin wrapper over Google Analytics 4 (gtag). The loader lives in index.html;
// here we only push events. Every call is a no-op if gtag never loaded (blocked
// by an ad blocker, or the measurement id is absent), so analytics can never
// break a page. See docs/planning/analytics-plan.md Layer B.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

/** Fire a custom GA4 event. Safe to call even if gtag is unavailable. */
export function track(event: string, params?: Record<string, unknown>) {
  window.gtag?.('event', event, params)
}

/**
 * Manually send a page_view. Required for the SPA: gtag is configured with
 * send_page_view:false, so React-Router navigations would otherwise never
 * register. Called from RouteTracker in App.tsx on every location change.
 */
export function trackPageView(path: string) {
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const CLIENT = 'ca-pub-5982385876517812'

// One AdSense ad unit. NOT wired into any page yet — placement waits until the
// AdSense account is approved and real `data-ad-slot` IDs exist (adsense-plan
// §3.5 / §3.6). Until then this component is dormant.
//
// Two things it has to defend against in a React Router SPA:
//   1. StrictMode runs effects twice in dev, and React can re-run an effect on
//      re-render. Pushing the same <ins> twice makes AdSense throw
//      "already have ads in them". The `pushed` ref makes the push idempotent.
//   2. React Router reuses DOM nodes across routes, so navigating from one
//      suburb to another would keep the already-filled <ins> and never refresh.
//      Callers must pass a `key` that changes with the route (see §3.6 usage)
//      to force a remount.
//
// If an ad blocker is present the script never loads, push() throws, and the
// <ins> stays empty — the wrapper collapses via the [data-ad-status] rule in
// index.css so there is no dead space.
export default function AdSlot({
  slot,
  className = '',
}: {
  slot: string
  className?: string
}) {
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle ?? []).push({})
    } catch {
      // Script blocked or not loaded yet. Leaving the slot empty is the correct
      // outcome, and retrying just spams the console.
    }
  }, [])

  return (
    <div className={`my-6 ${className}`}>
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-dim">
        Advertisement
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-surface-2">
        <ins
          className="adsbygoogle block"
          style={{ display: 'block' }}
          data-ad-client={CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  )
}

import { useSyncExternalStore } from 'react'

/**
 * Live `window.matchMedia(query).matches`. Read synchronously on first render,
 * so there is no flash of the wrong layout. Server/test DOMs without
 * matchMedia report `false`.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onChange => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches),
    () => false,
  )
}

/** Tailwind's `sm` breakpoint (640px) and up. */
export const SM_UP = '(min-width: 640px)'

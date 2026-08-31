import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Only ever bounce back to our own site — a hard stop against open redirects,
// even if a bad target_url somehow lands in the table.
const ALLOWED_PREFIX = 'https://www.suburblensapp.com/'

export default function RedirectPage() {
  const { code } = useParams<{ code: string }>()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!code) {
        setNotFound(true)
        return
      }
      const { data, error } = await supabase.rpc('resolve_short_link', { p_code: code })
      if (cancelled) return
      const target = typeof data === 'string' ? data : null
      if (error || !target || !target.startsWith(ALLOWED_PREFIX)) {
        setNotFound(true)
      } else {
        // Full-page navigation (not React routing) so GA re-initialises on the
        // target and reads its UTM params. replace() keeps /r/ out of history.
        window.location.replace(target)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-5 text-center">
      {notFound ? (
        <div className="space-y-4">
          <p className="font-display text-lg text-fg">链接无效或已失效</p>
          <Link
            to="/"
            className="font-mono text-[11px] uppercase tracking-wider text-faint transition-colors hover:text-lemon"
          >
            回首页 →
          </Link>
        </div>
      ) : (
        <p className="font-mono text-[11px] uppercase tracking-wider text-faint">正在跳转…</p>
      )}
    </div>
  )
}

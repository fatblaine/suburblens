import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

// Where the password-reset email link lands. Supabase's detectSessionInUrl
// parses the recovery token from the URL and establishes a temporary session
// (firing PASSWORD_RECOVERY). We confirm that session exists before letting the
// user set a new password, then call updateUser({ password }).
export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  // null = still checking the link; true = valid recovery session; false = invalid/expired.
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true

    // The client may have already consumed the URL and set the session before
    // this page mounted, so check the current session first…
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true)
    })
    // …and also listen, in case the recovery event arrives a beat later.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && (event === 'PASSWORD_RECOVERY' || session)) setReady(true)
    })
    // If nothing shows up, the link is invalid or expired.
    const t = setTimeout(() => { if (active) setReady(prev => (prev === null ? false : prev)) }, 2500)

    return () => { active = false; sub.subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
      // The recovery session is now a full session — send them into the app.
      setTimeout(() => navigate('/', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-md bg-ink-2 p-10 sm:p-12 rounded-2xl border border-white/[0.06] shadow-2xl shadow-black/50">

        <div className="flex items-center gap-3 font-display font-bold text-lg text-white tracking-tight mb-8">
          <img src="/logo.svg" alt="" className="w-7 h-7" />
          SuburbLens
        </div>

        {ready === null && (
          <p className="text-sm text-faint">Verifying your reset link…</p>
        )}

        {ready === false && !done && (
          <>
            <h2 className="font-display font-semibold text-[22px] text-fg tracking-tight mb-2">
              This reset link is invalid or has expired
            </h2>
            <p className="text-sm text-faint mb-8">
              Reset links can only be used once and expire after a while. Request a fresh one from the sign-in screen.
            </p>
            <Link
              to="/login"
              className="inline-block w-full text-center py-3.5 bg-lemon hover:brightness-95 text-ink font-display font-semibold rounded-[10px] transition-all"
            >
              Back to sign in
            </Link>
          </>
        )}

        {ready === true && !done && (
          <>
            <h2 className="font-display font-semibold text-[22px] text-fg tracking-tight mb-1.5">
              Set a new password
            </h2>
            <p className="text-sm text-faint mb-8">
              Choose a new password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] uppercase text-faint mb-2">New password</label>
                <input
                  type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-4 py-3.5 rounded-[10px] bg-surface-2 border border-white/10 text-fg placeholder:text-dim focus:outline-none focus:border-lemon/60 transition-colors"
                />
              </div>
              <div>
                <label className="block font-mono text-[11px] tracking-[0.12em] uppercase text-faint mb-2">Confirm password</label>
                <input
                  type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-4 py-3.5 rounded-[10px] bg-surface-2 border border-white/10 text-fg placeholder:text-dim focus:outline-none focus:border-lemon/60 transition-colors"
                />
              </div>

              {error && <p className="text-rented text-sm">{error}</p>}

              <button
                type="submit" disabled={busy}
                className="w-full py-3.5 bg-lemon hover:brightness-95 text-ink font-display font-semibold rounded-[10px] transition-all disabled:opacity-50"
              >
                {busy ? '…' : 'Update password'}
              </button>
            </form>
          </>
        )}

        {done && (
          <>
            <h2 className="font-display font-semibold text-[22px] text-fg tracking-tight mb-2">
              Password updated
            </h2>
            <p className="text-sm text-owned">You're all set — taking you back to SuburbLens…</p>
          </>
        )}

      </div>
    </main>
  )
}

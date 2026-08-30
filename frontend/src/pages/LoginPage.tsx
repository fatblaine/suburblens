import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function LoginPage() {
  const { session, isGuest, signInWithPassword, signUp, sendPasswordReset, signInAsGuest } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  // Set when the user explicitly chooses "Continue as guest" so we redirect them
  // home once the (async) session lands — without auto-bouncing an existing guest
  // who opened /login on purpose to upgrade to a real account.
  const [pendingGuest, setPendingGuest] = useState(false)
  // Drives the fade-out before we hand off to the home page.
  const [leaving, setLeaving] = useState(false)

  // Registered users skip the login screen; a just-signed-in guest is sent home too.
  // Fade the login screen out first, then navigate once the transition has played.
  useEffect(() => {
    if (session && (!isGuest || pendingGuest)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 触发淡出动画确实需要 state
      setLeaving(true)
      const t = setTimeout(() => navigate('/', { replace: true }), 550)
      return () => clearTimeout(t)
    }
  }, [session, isGuest, pendingGuest, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'login') {
        await signInWithPassword(email, password)
      } else if (mode === 'forgot') {
        await sendPasswordReset(email)
        // Neutral wording on purpose: Supabase does not reveal whether the email
        // is registered, so we must not either.
        setInfo("If an account exists for that email, we've sent a password reset link. Check your inbox.")
        setMode('login')
      } else {
        const { needsConfirmation } = await signUp(email, password)
        if (needsConfirmation) {
          // "Confirm email" is on: no session yet — send them to verify, don't redirect.
          setInfo('Account created. We sent a confirmation link to your email — click it to activate your account, then sign in.')
          setMode('login')
        }
        // Otherwise confirmation is off and the session lands automatically → the
        // redirect effect takes them home.
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setError(
        msg.includes('Email not confirmed')
          ? 'Your email is not verified yet. Please click the confirmation link we sent you first.'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleGuest() {
    setError(''); setBusy(true)
    try {
      await signInAsGuest()
      setPendingGuest(true)   // redirect home once the session is in state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a guest session.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      className={`min-h-screen flex items-center justify-center bg-ink px-4 py-10 transition-all duration-500 ease-out ${
        leaving ? 'opacity-0 scale-[0.97] blur-sm' : 'opacity-100 scale-100'
      }`}
    >
      <div className="w-full max-w-5xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">

        {/* ── Left: editorial ───────────────────────────── */}
        <div
          className="hidden md:flex flex-col justify-between p-14"
          style={{ background: 'radial-gradient(120% 90% at 0% 0%, #15323a 0%, #0d0f14 55%)' }}
        >
          <div className="flex items-center gap-3 font-display font-bold text-xl text-white tracking-tight">
            <img src="/logo.svg" alt="" className="w-8 h-8" />
            SuburbLens
          </div>

          <div className="my-12">
            <div className="font-mono text-xs tracking-[0.18em] uppercase text-lemon mb-5">
              Census 2011 / 2016 / 2021
            </div>
            <h1 className="font-display font-bold text-[2.9rem] leading-[1.02] tracking-tight text-fg">
              Read any<br />Australian suburb<br />like a local.
            </h1>
          </div>

          <div className="font-mono text-xs text-faint">
            Sydney &amp; Melbourne · ABS Census data
          </div>
        </div>

        {/* ── Right: auth card ──────────────────────────── */}
        <div className="bg-ink-2 p-10 sm:p-14 flex flex-col justify-center border-l border-white/[0.06]">
          <h2 className="font-display font-semibold text-[26px] text-fg tracking-tight mb-1.5">
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create an account' : 'Reset your password'}
          </h2>
          <p className="text-sm text-faint mb-8">
            {mode === 'forgot'
              ? "Enter your email and we'll send you a reset link."
              : 'Sign in to save and compare your suburbs.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-mono text-[11px] tracking-[0.12em] uppercase text-faint mb-2">Email</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3.5 rounded-[10px] bg-surface-2 border border-white/10 text-fg placeholder:text-dim focus:outline-none focus:border-lemon/60 transition-colors"
              />
            </div>
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-mono text-[11px] tracking-[0.12em] uppercase text-faint">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setInfo('') }}
                      className="font-mono text-[11px] text-faint hover:text-lemon transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-4 py-3.5 rounded-[10px] bg-surface-2 border border-white/10 text-fg placeholder:text-dim focus:outline-none focus:border-lemon/60 transition-colors"
                />
              </div>
            )}

            {error && <p className="text-rented text-sm">{error}</p>}
            {info && <p className="text-owned text-sm">{info}</p>}

            <button
              type="submit" disabled={busy}
              className="w-full py-3.5 bg-lemon hover:brightness-95 text-ink font-display font-semibold rounded-[10px] transition-all disabled:opacity-50"
            >
              {busy ? '…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo('')
            }}
            className="w-full mt-3 text-faint hover:text-fg text-sm transition-colors"
          >
            {mode === 'signup' ? 'Have an account? Sign in'
              : mode === 'forgot' ? '← Back to sign in'
              : 'No account? Sign up'}
          </button>

          <div className="flex items-center gap-3.5 my-5 text-dim text-xs">
            <span className="h-px flex-1 bg-white/[0.08]" />or<span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <button
            onClick={handleGuest} disabled={busy}
            className="w-full py-3.5 border border-white/15 hover:border-white/30 text-fg font-display font-medium rounded-[10px] transition-colors disabled:opacity-50"
          >
            Continue as guest →
          </button>
          <p className="text-xs text-dim text-center mt-5">
            No card. Guests get full access to all suburb data. The AI assistant requires an account.
          </p>
        </div>
      </div>
    </main>
  )
}

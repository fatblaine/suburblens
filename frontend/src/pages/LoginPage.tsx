import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export default function LoginPage() {
  const { session, signInWithPassword, signUp, signInAsGuest } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  // Already signed in (including as a guest) → go straight to the app.
  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (mode === 'login') {
        await signInWithPassword(email, password)
      } else {
        await signUp(email, password)
        setInfo('Account created. If email confirmation is enabled, check your inbox — otherwise you are signed in.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGuest() {
    setError(''); setBusy(true)
    try {
      await signInAsGuest()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a guest session.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-md border border-white/15 shadow-xl shadow-black/20 rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white text-center mb-1">SuburbLens</h1>
        <p className="text-white/50 text-sm text-center mb-6">
          {mode === 'login' ? 'Log in to continue' : 'Create an account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
          />
          <input
            type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40"
          />
          {error && <p className="text-red-300 text-sm">{error}</p>}
          {info && <p className="text-green-300 text-sm">{info}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full py-3 bg-white/20 hover:bg-white/30 border border-white/20 text-white font-semibold rounded-xl transition-colors disabled:opacity-40"
          >
            {busy ? '…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo('') }}
          className="w-full mt-3 text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          {mode === 'login' ? "No account? Sign up" : 'Have an account? Log in'}
        </button>

        <div className="flex items-center gap-3 my-5">
          <span className="h-px flex-1 bg-white/15" />
          <span className="text-white/30 text-xs">or</span>
          <span className="h-px flex-1 bg-white/15" />
        </div>

        <button
          onClick={handleGuest} disabled={busy}
          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 font-semibold rounded-xl transition-colors disabled:opacity-40"
        >
          Continue as guest
        </button>
        <p className="text-white/30 text-xs text-center mt-3">
          Guests can browse all suburb data. The AI assistant requires an account.
        </p>
      </div>
    </main>
  )
}

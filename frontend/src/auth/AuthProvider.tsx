import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  /** A guest is an anonymous Supabase user (signInAnonymously). */
  isGuest: boolean
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Resolves with needsConfirmation=true when Supabase's "Confirm email" is on (no session yet). */
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  /** Emails a password-reset link that lands the user on /reset-password. */
  sendPasswordReset: (email: string) => Promise<void>
  /** Sets a new password for the current (recovery) session. */
  updatePassword: (newPassword: string) => Promise<void>
  signInAsGuest: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Read any persisted session on first load, then keep it in sync.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const isGuest = user?.is_anonymous === true

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }
  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Where the confirmation link lands the user; must be whitelisted in
      // Supabase → Authentication → URL Configuration → Redirect URLs.
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    if (error) throw error
    // With "Confirm email" enabled, Supabase returns no session until the user
    // clicks the link. Absence of a session is our signal to prompt for it.
    return { needsConfirmation: !data.session }
  }
  async function sendPasswordReset(email: string) {
    // Same redirect infra as signup: the target must be whitelisted in
    // Supabase → Authentication → URL Configuration → Redirect URLs, and the
    // Site URL must be the real domain (otherwise the link falls back to it).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }
  async function updatePassword(newPassword: string) {
    // Works against the temporary session the recovery link established.
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }
  async function signInAsGuest() {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw error
  }
  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, user, isGuest, loading, signInWithPassword, signUp, sendPasswordReset, updatePassword, signInAsGuest, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

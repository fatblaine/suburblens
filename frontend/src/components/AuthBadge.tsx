import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

/** Small fixed badge showing the current identity + a log in/out action.
 *  Renders nothing when there is no session (e.g. on the login screen). */
export default function AuthBadge() {
  const { session, user, isGuest, signOut } = useAuth()
  const navigate = useNavigate()

  if (!session) return null

  async function handleClick() {
    if (isGuest) {
      navigate('/login')          // guest → upgrade to a real account
    } else {
      await signOut()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 font-mono text-xs">
      <span className="px-2.5 py-1 rounded-lg bg-surface-2 border border-white/10 text-muted">
        {isGuest ? 'Guest' : user?.email}
      </span>
      <button
        onClick={handleClick}
        className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 border border-white/10 text-fg transition-colors"
      >
        {isGuest ? 'Log in' : 'Log out'}
      </button>
    </div>
  )
}

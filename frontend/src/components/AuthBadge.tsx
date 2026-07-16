import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

/** Small fixed badge showing the current identity + a log in/out action.
 *  Signed-out visitors arrive via shared links: no identity to show, but they
 *  still get a way in. */
export default function AuthBadge() {
  const { session, user, isGuest, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // The map is full-bleed and has its own top-right zoom controls; the badge
  // would sit on top of them, so hide it there (Back returns to a page that
  // shows the badge again). The login screen has its own actions.
  // Waiting on `loading` keeps a returning user from seeing "Sign in" flash
  // before their persisted session resolves.
  if (loading || location.pathname === '/map' || location.pathname === '/login') return null

  async function handleClick() {
    if (!session || isGuest) {
      navigate('/login')          // signed out or guest → upgrade to a real account
    } else {
      await signOut()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 font-mono text-xs">
      {session && (
        <span className="px-2.5 py-1 rounded-lg bg-surface-2 border border-white/10 text-muted block max-w-[45vw] sm:max-w-[220px] truncate">
          {isGuest ? 'Guest' : user?.email}
        </span>
      )}
      <button
        onClick={handleClick}
        className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 border border-white/10 text-fg transition-colors"
      >
        {!session ? 'Sign in' : isGuest ? 'Log in' : 'Log out'}
      </button>
    </div>
  )
}

import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

/** Small badge showing the current identity + a log in/out action.
 *  Signed-out visitors arrive via shared links: no identity to show, but they
 *  still get a way in.
 *
 *  Default: fixed to the viewport's top-right corner (mounted once in App).
 *  `inline`: rendered inside a page header instead, sized to match its buttons.
 *  The home page does this so the badge lines up with its content column. */
export default function AuthBadge({ inline = false }: { inline?: boolean } = {}) {
  const { session, user, isGuest, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // The map is full-bleed and has its own top-right zoom controls; the badge
  // would sit on top of them, so hide it there (Back returns to a page that
  // shows the badge again). The login screen has its own actions. The home
  // page renders its own inline copy in its header, so the fixed one steps aside.
  // Waiting on `loading` keeps a returning user from seeing "Sign in" flash
  // before their persisted session resolves.
  if (loading) return null
  if (!inline && ['/', '/map', '/login'].includes(location.pathname)) return null

  async function handleClick() {
    if (!session || isGuest) {
      navigate('/login')          // signed out or guest → upgrade to a real account
    } else {
      await signOut()
      navigate('/login', { replace: true })
    }
  }

  // Inline: same box as the header's other buttons (border-white/15, py-2.5).
  const pad = inline ? 'px-3.5 py-2.5' : 'px-2.5 py-1'
  const border = inline ? 'border-white/15' : 'border-white/10'

  return (
    <div
      className={
        inline
          ? 'flex items-center gap-2 font-mono text-xs min-w-0'
          : 'fixed top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 z-50 flex items-center gap-2 font-mono text-xs'
      }
    >
      {/* Inline (home header): the identity only fits beside the nav and the
          extension button on wide screens (lg); the log in/out button always shows. */}
      {session && (
        <span className={`${pad} rounded-lg bg-surface-2 border ${border} text-muted ${inline ? 'hidden lg:block' : 'block'} max-w-[45vw] sm:max-w-[220px] truncate`}>
          {isGuest ? 'Guest' : user?.email}
        </span>
      )}
      <button
        onClick={handleClick}
        className={`${pad} shrink-0 rounded-lg bg-surface-2 hover:bg-surface-3 border ${border} text-fg transition-colors`}
      >
        {!session ? 'Sign in' : isGuest ? 'Log in' : 'Log out'}
      </button>
    </div>
  )
}

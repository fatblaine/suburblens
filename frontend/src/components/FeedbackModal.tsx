import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { track } from '../lib/analytics'
import { CARD } from '../lib/theme'

const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY as string | undefined
const THROTTLE_MS = 60_000
const LS_KEY = 'feedback:lastSent'

type Status = 'idle' | 'sending' | 'sent' | 'error'

// Lightweight contact/feedback form. Posts straight to Web3Forms, which relays
// the message to the site owner's inbox — no backend or database involved.
// Anonymous by design (no login gate); a honeypot field plus a per-browser
// throttle keep casual bots and double-submits out.
export default function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, isGuest } = useAuth()
  // Prefill only for a real signed-in user; anonymous "guest" sessions have no useful email.
  const knownEmail = !isGuest ? user?.email ?? '' : ''
  const [email, setEmail] = useState(knownEmail)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const botcheck = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!message.trim()) {
      setError('Please write a message first.')
      return
    }
    // Honeypot: humans never see this checkbox; bots tend to tick it.
    if (botcheck.current?.checked) return
    // Client-side throttle: one message per minute per browser.
    const last = Number(localStorage.getItem(LS_KEY) || 0)
    if (Date.now() - last < THROTTLE_MS) {
      setError('You just sent feedback — please wait a minute before sending again.')
      return
    }
    if (!WEB3FORMS_KEY) {
      setError('Feedback is not configured yet.')
      return
    }

    setStatus('sending')
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: 'SuburbLens feedback',
          from_name: 'SuburbLens visitor',
          email: email.trim() || undefined, // becomes reply-to; optional
          message: message.trim(),
          page: window.location.href, // context to help triage
          user_id: user?.id ?? 'anon',
        }),
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem(LS_KEY, String(Date.now()))
        setStatus('sent')
        setMessage('')
        track('feedback_sent', { hasEmail: !!email.trim() })
      } else {
        setStatus('error')
        setError(data.message || 'Something went wrong. Please try again later.')
      }
    } catch {
      setStatus('error')
      setError('Network error. Please try again later.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Send feedback"
    >
      <div className={`${CARD} w-full max-w-md p-6`} onClick={(e) => e.stopPropagation()}>
        {status === 'sent' ? (
          <div className="text-center">
            <p className="font-display text-lg text-fg">Thanks — got it.</p>
            <p className="mt-2 text-sm text-muted">
              Your message landed in our inbox. We read every one.
            </p>
            <button
              onClick={onClose}
              className="mt-5 rounded-lg bg-lemon px-4 py-2 font-mono text-xs text-ink"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-lemon">Contact</p>
                <h2 className="mt-1 font-display text-lg text-fg">Send feedback</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-dim transition-colors hover:text-fg"
              >
                ✕
              </button>
            </div>

            <p className="mt-1 text-xs text-muted">
              Found a bug, or something confusing? Tell us — it goes straight to the maker.
            </p>

            <label className="mt-4 block font-mono text-[11px] text-faint" htmlFor="fb-message">
              Message
            </label>
            <textarea
              id="fb-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              autoFocus
              className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-surface-2 p-3 text-sm text-fg placeholder:text-dim focus:border-lemon/60 focus:outline-none"
              placeholder="What's on your mind?"
            />

            <label className="mt-3 block font-mono text-[11px] text-faint" htmlFor="fb-email">
              Email <span className="text-dim">(optional — so we can reply)</span>
            </label>
            <input
              id="fb-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-2 p-2.5 text-sm text-fg placeholder:text-dim focus:border-lemon/60 focus:outline-none"
              placeholder="you@example.com"
            />

            {/* Honeypot — hidden from humans, catches simple bots */}
            <input
              ref={botcheck}
              type="checkbox"
              name="botcheck"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            {error && (
              <p className="mt-3 text-xs" style={{ color: '#f2685c' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="mt-5 w-full rounded-lg bg-lemon px-4 py-2.5 font-mono text-xs text-ink disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

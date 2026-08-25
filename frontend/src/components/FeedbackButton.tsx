import { useState } from 'react'
import { track } from '../lib/analytics'
import FeedbackModal from './FeedbackModal'

// Prominent outlined ("ghost") feedback button — opens the shared FeedbackModal.
// Distinct from the low-key text link in the Footer; use this where feedback
// should be visible up front (home hero, login screen).
export default function FeedbackButton({
  placement,
  className = '',
  label = 'Send feedback',
}: {
  placement: string
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          track('feedback_open', { placement })
        }}
        className={`inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-mono text-xs text-fg transition-colors hover:border-lemon/60 hover:text-lemon ${className}`}
      >
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {label}
      </button>
      {open && <FeedbackModal open onClose={() => setOpen(false)} />}
    </>
  )
}

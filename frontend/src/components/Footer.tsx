import { useState } from 'react'
import { Link } from 'react-router-dom'
import { track } from '../lib/analytics'
import FeedbackModal from './FeedbackModal'
import ExternalLink from './ExternalLink'
import { isNativeApp } from '../lib/platform'

const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/suburblens/ipibeapbfhilcffdbaeihcholjjdchej'

const Dot = () => (
  <span aria-hidden="true" className="text-white/15">
    ·
  </span>
)

// Site-wide footer. Its main job for AdSense is navigation: a reviewer landing
// on any page can reach /about and /privacy from here, and every suburb page
// linking to them is a strong internal-link signal for Search too.
//
export default function Footer({ className = '' }: { className?: string }) {
  const [fbOpen, setFbOpen] = useState(false)

  return (
    <footer className={`font-mono text-xs text-dim ${className}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Link to="/about" className="transition-colors hover:text-lemon">
          About
        </Link>
        <Dot />
        <Link to="/methodology" className="transition-colors hover:text-lemon">
          Methodology
        </Link>
        <Dot />
        <Link to="/suburbs" className="transition-colors hover:text-lemon">
          All suburbs
        </Link>
        <Dot />
        <Link to="/privacy" className="transition-colors hover:text-lemon">
          Privacy
        </Link>
        {/* A Chrome extension is useless on an iPhone, and App Review frowns on
            pointing users at other platforms. */}
        {!isNativeApp && (
          <>
            <Dot />
            <ExternalLink
              href={CHROME_STORE_URL}
              onClick={() => track('extension_click', { placement: 'footer' })}
              className="transition-colors hover:text-lemon"
            >
              Chrome extension
            </ExternalLink>
          </>
        )}
        <Dot />
        <button
          type="button"
          onClick={() => {
            setFbOpen(true)
            track('feedback_open', { placement: 'footer' })
          }}
          className="transition-colors hover:text-lemon"
        >
          Feedback
        </button>
      </div>
      <p className="mt-2 text-dim/80">
        Covers Sydney &amp; Melbourne suburbs only. Data source: Australian Bureau of Statistics, Census of
        Population and Housing 2021. An independent project, not affiliated with the ABS.
      </p>
      {/* ODbL requires attribution wherever OpenStreetMap-derived data is shown.
          Local-amenity counts come from OSM, so this line is a licence condition,
          not a courtesy — do not remove it while that feature is live. */}
      <p className="mt-1 text-dim/80">
        Local amenity counts:{' '}
        <ExternalLink
          href="https://www.openstreetmap.org/copyright"
          className="transition-colors hover:text-lemon"
        >
          &copy; OpenStreetMap contributors
        </ExternalLink>
        , available under the Open Database Licence (ODbL).
      </p>

      {fbOpen && <FeedbackModal open onClose={() => setFbOpen(false)} />}
    </footer>
  )
}

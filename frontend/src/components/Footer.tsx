import { Link } from 'react-router-dom'
import { track } from '../lib/analytics'

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
// /methodology and /suburbs are commented out on purpose — those routes do not
// exist yet, and React Router has no catch-all, so a link to them would open a
// blank page (a listed AdSense rejection reason). Un-comment each line the day
// its page ships (adsense-plan.md §8.5.3 / §8.5.4).
export default function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`font-mono text-xs text-dim ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Covers Sydney &amp; Melbourne suburbs only.</span>
        <Dot />
        <Link to="/about" className="transition-colors hover:text-lemon">
          About
        </Link>
        <Dot />
        {/*
        <Link to="/methodology" className="transition-colors hover:text-lemon">
          Methodology
        </Link>
        <Dot />
        <Link to="/suburbs" className="transition-colors hover:text-lemon">
          All suburbs
        </Link>
        <Dot />
        */}
        <Link to="/privacy" className="transition-colors hover:text-lemon">
          Privacy
        </Link>
        <Dot />
        <a
          href={CHROME_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('extension_click', { placement: 'footer' })}
          className="transition-colors hover:text-lemon"
        >
          Chrome extension
        </a>
      </div>
      <p className="mt-2 text-dim/80">
        Data source: Australian Bureau of Statistics, Census of Population and Housing 2021. An independent
        project, not affiliated with the ABS.
      </p>
    </footer>
  )
}

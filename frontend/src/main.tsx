import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StatusBar, Style } from '@capacitor/status-bar'
import './index.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import { isNativeApp } from './lib/platform'

// Amplify's default domain for the main branch cannot be turned off, and it
// serves the same build as the custom domain — so every page exists at two
// hostnames and Google has to guess which is real. Amplify's redirect rules can
// only branch on country code, not Host, so there is no server-side 301 to
// write. This client-side hop is the backstop for the <link rel="canonical"> in
// index.html: Googlebot runs JS and will follow it, and real users who land on
// the old URL end up on the branded one.
//
// Only the main branch's host is listed. Preview branches (dev.*) and localhost
// must keep working as themselves.
const CANONICAL_HOST = 'www.suburblensapp.com'
const LEGACY_HOSTS = ['main.d1yrvhzuhaioqy.amplifyapp.com']

if (LEGACY_HOSTS.includes(location.hostname)) {
  location.replace(
    `https://${CANONICAL_HOST}${location.pathname}${location.search}${location.hash}`,
  )
}

// iOS app shell (Capacitor). Runs before the first render so the very first
// paint already sits clear of the notch.
if (isNativeApp) {
  // `.native` scopes the app-only CSS in index.css (safe-area padding etc.).
  document.documentElement.classList.add('native')
  // viewport-fit=cover lets the page draw under the status bar and home
  // indicator, which is what makes env(safe-area-inset-*) non-zero. Set here,
  // not in index.html, so mobile Safari on the website is unaffected.
  document
    .querySelector('meta[name=viewport]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
  // Style.Dark = light status-bar text, for the dark Nocturne background.
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
}

// On-device console for TestFlight builds: without a Mac there is no Safari
// Web Inspector. Only bundled when the build sets VITE_DEBUG_CONSOLE=true
// (the ios-beta workflow in codemagic.yaml), never in the website or the
// App Store build.
if (import.meta.env.VITE_DEBUG_CONSOLE === 'true') {
  import('eruda').then(({ default: eruda }) => eruda.init())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

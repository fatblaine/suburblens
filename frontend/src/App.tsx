import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './pages/HomePage'
import SuburbDetailPage from './pages/SuburbDetailPage'
import ComparePage from './pages/ComparePage'
import MapPage from './pages/MapPage'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import PrivacyPage from './pages/PrivacyPage'
import AboutPage from './pages/AboutPage'
import MethodologyPage from './pages/MethodologyPage'
import BrowsePage from './pages/BrowsePage'
import RedirectPage from './pages/RedirectPage'
import AuthBadge from './components/AuthBadge'
import { trackPageView } from './lib/analytics'

const queryClient = new QueryClient()

// GA4 is loaded with send_page_view:false, so in-app navigations report nothing
// unless we send page_view ourselves. Must live inside BrowserRouter (uses
// useLocation). The setTimeout defers one tick so PageMeta has swapped
// document.title for the new route before we read it.
function RouteTracker() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    // /r/:code is a bounce, not a real page — skip it so GA keeps only the
    // UTM'd target the redirect lands on.
    if (pathname.startsWith('/r/')) return
    const id = setTimeout(() => trackPageView(pathname + search), 0)
    return () => clearTimeout(id)
  }, [pathname, search])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RouteTracker />
        <AuthBadge />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Every data page is public: a shared link has to open cold, and
              /api/suburbs/* serves all of this without a token anyway.
              Signing in only buys the AI assistant. */}
          <Route path="/" element={<HomePage />} />
          <Route path="/suburb/:salCode" element={<SuburbDetailPage />} />
          <Route path="/suburbs" element={<BrowsePage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/map" element={<MapPage />} />

          {/* Promo short links: /r/:code resolves via Supabase, then does a
              full-page redirect to the UTM'd target. See short-link-plan.md. */}
          <Route path="/r/:code" element={<RedirectPage />} />

          {/* Must stay reachable signed-out: the Chrome Web Store listing links
              here, and reviewers open it without an account. */}
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

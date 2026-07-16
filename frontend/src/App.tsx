import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './pages/HomePage'
import SuburbDetailPage from './pages/SuburbDetailPage'
import ComparePage from './pages/ComparePage'
import MapPage from './pages/MapPage'
import LoginPage from './pages/LoginPage'
import AuthBadge from './components/AuthBadge'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBadge />
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Every data page is public: a shared link has to open cold, and
              /api/suburbs/* serves all of this without a token anyway.
              Signing in only buys the AI assistant. */}
          <Route path="/" element={<HomePage />} />
          <Route path="/suburb/:salCode" element={<SuburbDetailPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

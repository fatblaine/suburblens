import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './pages/HomePage'
import SuburbDetailPage from './pages/SuburbDetailPage'
import ComparePage from './pages/ComparePage'
import MapPage from './pages/MapPage'
import LoginPage from './pages/LoginPage'
import RequireAuth from './auth/RequireAuth'
import AuthBadge from './components/AuthBadge'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBadge />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Everything else requires a session (guest or registered) */}
          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/suburb/:salCode" element={<RequireAuth><SuburbDetailPage /></RequireAuth>} />
          <Route path="/compare" element={<RequireAuth><ComparePage /></RequireAuth>} />
          <Route path="/map" element={<RequireAuth><MapPage /></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

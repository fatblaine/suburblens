import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './pages/HomePage'
import SuburbDetailPage from './pages/SuburbDetailPage'
import ComparePage from './pages/ComparePage'
import MapPage from './pages/MapPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/suburb/:salCode" element={<SuburbDetailPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './pages/HomePage'
import SuburbDetailPage from './pages/SuburbDetailPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/suburb/:salCode" element={<SuburbDetailPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

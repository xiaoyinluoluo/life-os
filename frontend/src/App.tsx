import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Review from './pages/Review'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import Companion from './pages/Companion'
import Planning from './pages/Planning'
import Knowledge from './pages/Knowledge'
import Personal from './pages/Personal'
import Settings from './pages/Settings'

export default function App() {
  return <BrowserRouter><Routes><Route element={<Layout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="personal" element={<Personal />} />
    <Route path="companion" element={<Companion />} />
    <Route path="planning" element={<Planning />} />
    <Route path="knowledge" element={<Knowledge />} />
    <Route path="settings" element={<Settings />} />
    <Route path="review" element={<Review />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Route></Routes></BrowserRouter>
}

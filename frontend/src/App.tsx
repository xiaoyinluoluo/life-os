import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import Companion from './pages/Companion'
import Planning from './pages/Planning'
import Knowledge from './pages/Knowledge'

export default function App() {
  return <BrowserRouter><Routes><Route element={<Layout />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="companion" element={<Companion />} />
    <Route path="planning" element={<Planning />} />
    <Route path="knowledge" element={<Knowledge />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Route></Routes></BrowserRouter>
}

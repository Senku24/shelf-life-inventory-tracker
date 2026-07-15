import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { Loading } from './components/ui'
import Layout from './components/Layout'
import LoginForm from './pages/LoginForm'
import RegisterForm from './pages/RegisterForm'
import Dashboard from './pages/Dashboard'
import HouseholdManager from './pages/HouseholdManager'
import InventoryList from './pages/InventoryList'
import AddItemForm from './pages/AddItemForm'

function PrivateRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? <Layout /> : <Navigate to="/login" replace />
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<PublicOnly><LoginForm /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><RegisterForm /></PublicOnly>} />

            <Route element={<PrivateRoutes />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/household" element={<HouseholdManager />} />
              <Route path="/items" element={<InventoryList />} />
              <Route path="/add" element={<AddItemForm />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

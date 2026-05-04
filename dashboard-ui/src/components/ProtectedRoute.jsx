import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// token yoksa /login, belirtilen yetki yoksa /map'e yönlendirir.
export default function ProtectedRoute({ permission, children }) {
  const { token, hasPermission } = useAuth()

  if (!token) return <Navigate to="/login" replace />
  if (permission && !hasPermission(permission)) return <Navigate to="/map" replace />

  return children
}

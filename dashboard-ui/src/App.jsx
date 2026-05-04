import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import './index.css'

const TrafficLights = lazy(() => import('./pages/TrafficLights'))
const Density       = lazy(() => import('./pages/Density'))
const SpeedViolations = lazy(() => import('./pages/SpeedViolations'))
const Map           = lazy(() => import('./pages/Map'))
const Predictions   = lazy(() => import('./pages/Predictions'))
const Login         = lazy(() => import('./pages/Login'))

const NAV_LINKS = [
  { to: '/traffic-lights', label: '🚦 Trafik Işıkları', perm: 'view_traffic' },
  { to: '/density',        label: '📊 Yoğunluk',        perm: 'view_density' },
  { to: '/speed-violations', label: '🚨 Hız İhlalleri', perm: 'view_speed'   },
  { to: '/map',            label: '🗺️ Harita',           perm: 'view_map'     },
  { to: '/predictions',    label: '🤖 Tahminler',        perm: 'view_traffic' },
]

function Nav() {
  const { claims, hasPermission, logout } = useAuth()
  if (!claims) return null

  return (
    <nav className="nav">
      <h1>🏙️ Kentsel Veri Analitiği — Canlı Dashboard</h1>
      <div className="nav-links">
        {NAV_LINKS.filter(l => hasPermission(l.perm)).map(l => (
          <Link key={l.to} to={l.to}>{l.label}</Link>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
          {claims.email} — <strong style={{ color: '#60a5fa' }}>{claims.role}</strong>
        </span>
        <button onClick={logout} style={logoutStyle}>Çıkış</button>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Nav />
          <Suspense fallback={<div style={{ padding: '2rem', color: '#94a3b8' }}>Yükleniyor...</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/map" element={
                <ProtectedRoute permission="view_map"><Map /></ProtectedRoute>
              } />
              <Route path="/traffic-lights" element={
                <ProtectedRoute permission="view_traffic"><TrafficLights /></ProtectedRoute>
              } />
              <Route path="/density" element={
                <ProtectedRoute permission="view_density"><Density /></ProtectedRoute>
              } />
              <Route path="/speed-violations" element={
                <ProtectedRoute permission="view_speed"><SpeedViolations /></ProtectedRoute>
              } />
              <Route path="/predictions" element={
                <ProtectedRoute permission="view_traffic"><Predictions /></ProtectedRoute>
              } />

              {/* Kök: giriş yapılmışsa map'e, değilse login'e */}
              <Route path="/" element={<Navigate to="/map" replace />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  )
}

const logoutStyle = {
  background: 'transparent',
  border: '1px solid #475569',
  borderRadius: '4px',
  color: '#94a3b8',
  padding: '0.25rem 0.6rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
}

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import './index.css'

const TrafficLights = lazy(() => import('./pages/TrafficLights'))
const Density = lazy(() => import('./pages/Density'))
const SpeedViolations = lazy(() => import('./pages/SpeedViolations'))
const Map = lazy(() => import('./pages/Map'))
const Predictions = lazy(() => import('./pages/Predictions'))

export default function App() {
  return (
    <Router>
      <div className="app">
        <nav className="nav">
          <h1>🏙️ Kentsel Veri Analitiği — Canlı Dashboard</h1>
          <div className="nav-links">
            <Link to="/traffic-lights">🚦 Trafik Işıkları</Link>
            <Link to="/density">📊 Yoğunluk</Link>
            <Link to="/speed-violations">🚨 Hız İhlalleri</Link>
            <Link to="/map">🗺️ Harita</Link>
            <Link to="/predictions">🤖 Tahminler</Link>
          </div>
        </nav>
        <Suspense fallback={<div style={{ padding: '2rem', color: '#94a3b8' }}>Yükleniyor...</div>}>
          <Routes>
            <Route path="/traffic-lights" element={<TrafficLights />} />
            <Route path="/density" element={<Density />} />
            <Route path="/speed-violations" element={<SpeedViolations />} />
            <Route path="/map" element={<Map />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/" element={<SpeedViolations />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  )
}

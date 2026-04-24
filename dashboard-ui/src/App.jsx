import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import TrafficLights from './pages/TrafficLights'
import Density from './pages/Density'
import SpeedViolations from './pages/SpeedViolations'
import Map from './pages/Map'
import './index.css'

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
          </div>
        </nav>
        <Routes>
          <Route path="/traffic-lights" element={<TrafficLights />} />
          <Route path="/density" element={<Density />} />
          <Route path="/speed-violations" element={<SpeedViolations />} />
          <Route path="/map" element={<Map />} />
          <Route path="/" element={<SpeedViolations />} />
        </Routes>
      </div>
    </Router>
  )
}

import { useState, useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { useAuth } from '../context/AuthContext'

const MQTT_URL = import.meta.env.VITE_MQTT_URL || 'ws://localhost:8083/mqtt'
const TOPIC = 'telemetry/speed_violations'
const MAX_ITEMS = 20
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
}

const formatHour = (iso) => {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`
}

export default function SpeedViolations() {
  const { token } = useAuth()
  const [view, setView] = useState('live')
  const [days, setDays] = useState(7)
  const [analytics, setAnalytics] = useState([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const [violations, setViolations] = useState([])
  const [connected, setConnected] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const clientRef = useRef(null)

  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clientId: 'dashboard-ui-speed-' + Math.random().toString(16).slice(2, 8),
    })
    clientRef.current = client

    client.on('connect', () => {
      console.log('EMQX bağlantısı kuruldu (speed_violations)')
      setConnected(true)
      client.subscribe(TOPIC, (err) => {
        if (!err) console.log('Subscribe OK:', TOPIC)
      })
    })
    client.on('message', (_topic, message) => {
      try {
        const batch = JSON.parse(message.toString())
        if (!Array.isArray(batch) || batch.length === 0) return
        setTotalCount(prev => prev + batch.length)
        setViolations(prev => [...batch, ...prev].slice(0, MAX_ITEMS))
      } catch (e) {
        console.error('Mesaj parse hatası:', e)
      }
    })
    client.on('close', () => setConnected(false))
    client.on('error', (err) => console.error('MQTT hata:', err))

    return () => client.end()
  }, [])

  useEffect(() => {
    if (view !== 'analytics') return
    setLoadingAnalytics(true)
    fetch(`${API_URL}/api/speed/analytics?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setAnalytics(Array.isArray(data) ? data : []))
      .catch(err => console.error('Analytics fetch hatası:', err))
      .finally(() => setLoadingAnalytics(false))
  }, [view, days, token])

  // Canlı görünüm hesaplamaları
  const chartData = violations.slice(0, 10).reverse().map((v, i) => ({
    name: v.vehicle_id || `#${i}`,
    speed: v.speed,
    limit: v.limit_val,
  }))
  const avgSpeed = violations.length > 0
    ? Math.round(violations.reduce((sum, v) => sum + v.speed, 0) / violations.length)
    : 0

  // Analiz görünüm hesaplamaları
  const totalViolations = analytics.reduce((s, d) => s + Number(d.violation_count), 0)
  const overallAvgExcess = analytics.length
    ? (analytics.reduce((s, d) => s + d.avg_excess, 0) / analytics.length).toFixed(1)
    : 0
  const overallMaxExcess = analytics.length
    ? Math.max(...analytics.map(d => d.max_excess)).toFixed(1)
    : 0
  const violationTrend = analytics.map(d => ({
    hour: formatHour(d.hour),
    'İhlal Sayısı': Number(d.violation_count),
  }))
  const excessTrend = analytics.map(d => ({
    hour: formatHour(d.hour),
    'Ort. Aşım (km/h)': Math.round(d.avg_excess),
    'Maks. Aşım (km/h)': Math.round(d.max_excess),
  }))
  const tickInterval = Math.max(1, Math.floor(violationTrend.length / 8))

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>🚨 Hız İhlalleri</h2>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button onClick={() => setView('live')} style={tabBtn(view === 'live')}>● Canlı Akış</button>
          <button onClick={() => setView('analytics')} style={tabBtn(view === 'analytics')}>📊 Geçmiş Analiz</button>
          {view === 'analytics' && (
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={selectStyle}>
              <option value={7}>Son 7 Gün</option>
              <option value={14}>Son 14 Gün</option>
              <option value={30}>Son 30 Gün</option>
            </select>
          )}
        </div>
      </div>

      {view === 'live' ? (
        <>
          <p className={`status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '● EMQX bağlı — canlı veri akıyor' : '● Bağlantı bekleniyor...'}
          </p>

          <div className="counter">
            <div className="counter-box">
              <div className="value">{totalCount}</div>
              <div className="label">Toplam İhlal</div>
            </div>
            <div className="counter-box">
              <div className="value">{avgSpeed} km/h</div>
              <div className="label">Ort. Hız</div>
            </div>
            <div className="counter-box">
              <div className="value">{violations.length}</div>
              <div className="label">Tablodaki Kayıt</div>
            </div>
          </div>

          <div className="chart-container">
            <h3>Son 10 İhlal — Hız vs Limit</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="speed" fill="#f87171" name="Hız (km/h)" />
                <Bar dataKey="limit" fill="#4ade80" name="Limit (km/h)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3>Son {MAX_ITEMS} İhlal</h3>
            <table>
              <thead>
                <tr>
                  <th>Araç</th><th>Hız</th><th>Limit</th><th>Aşım</th><th>Yön</th><th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v, i) => (
                  <tr key={i}>
                    <td>{v.vehicle_id}</td>
                    <td style={{ color: '#f87171', fontWeight: 700 }}>{v.speed} km/h</td>
                    <td style={{ color: '#4ade80' }}>{v.limit_val} km/h</td>
                    <td><span className="badge over">+{v.speed - v.limit_val} km/h</span></td>
                    <td><span className={`badge ${v.direction}`}>{v.direction}</span></td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      {v._timestamp ? new Date(v._timestamp).toLocaleTimeString('tr-TR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {loadingAnalytics ? (
            <p style={{ color: '#94a3b8', padding: '32px 0' }}>Veriler yükleniyor...</p>
          ) : analytics.length === 0 ? (
            <p style={{ color: '#94a3b8', padding: '32px 0' }}>Bu dönem için veri bulunamadı.</p>
          ) : (
            <>
              <div className="counter">
                <div className="counter-box">
                  <div className="value" style={{ color: '#f87171' }}>{totalViolations.toLocaleString('tr-TR')}</div>
                  <div className="label">Toplam İhlal</div>
                </div>
                <div className="counter-box">
                  <div className="value">+{overallAvgExcess} km/h</div>
                  <div className="label">Ort. Hız Aşımı</div>
                </div>
                <div className="counter-box">
                  <div className="value" style={{ color: '#fbbf24' }}>+{overallMaxExcess} km/h</div>
                  <div className="label">Maks. Hız Aşımı</div>
                </div>
                <div className="counter-box">
                  <div className="value">{analytics.length}</div>
                  <div className="label">Saatlik Veri Noktası</div>
                </div>
              </div>

              <div className="chart-container">
                <h3>Saatlik İhlal Sayısı</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={violationTrend}>
                    <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={tickInterval} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend />
                    <Bar dataKey="İhlal Sayısı" fill="#f87171" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-container">
                <h3>Ortalama ve Maksimum Hız Aşımı Trendi</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={excessTrend}>
                    <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={tickInterval} />
                    <YAxis tick={{ fill: '#94a3b8' }} unit=" km/h" />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend />
                    <Line type="monotone" dataKey="Ort. Aşım (km/h)" stroke="#fb923c" dot={false} />
                    <Line type="monotone" dataKey="Maks. Aşım (km/h)" stroke="#fbbf24" dot={false} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const tabBtn = (active) => ({
  padding: '7px 14px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  background: active ? '#3b82f6' : '#1e293b',
  color: active ? '#fff' : '#94a3b8',
  fontWeight: active ? 700 : 400,
  fontSize: '0.85rem',
})

const selectStyle = {
  padding: '6px 10px',
  borderRadius: 6,
  background: '#1e293b',
  color: '#e2e8f0',
  border: '1px solid #334155',
  fontSize: '0.85rem',
}

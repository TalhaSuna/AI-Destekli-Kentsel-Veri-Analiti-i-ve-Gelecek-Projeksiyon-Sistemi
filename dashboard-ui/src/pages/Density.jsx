import { useState, useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { useAuth } from '../context/AuthContext'

const MQTT_URL = import.meta.env.VITE_MQTT_URL || 'ws://localhost:8083/mqtt'
const TOPIC = 'telemetry/density'
const MAX_ITEMS = 50
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
}

const formatHour = (iso) => {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`
}

export default function Density() {
  const { token } = useAuth()
  const [view, setView] = useState('live')
  const [days, setDays] = useState(7)
  const [analytics, setAnalytics] = useState([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const [densityData, setDensityData] = useState([])
  const [connected, setConnected] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const clientRef = useRef(null)

  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clientId: 'dashboard-ui-density-' + Math.random().toString(16).slice(2, 8),
    })
    clientRef.current = client

    client.on('connect', () => {
      console.log('EMQX bağlantısı kuruldu (density)')
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
        setDensityData(prev => [...batch, ...prev].slice(0, MAX_ITEMS))
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
    fetch(`${API_URL}/api/density/analytics?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setAnalytics(Array.isArray(data) ? data : []))
      .catch(err => console.error('Analytics fetch hatası:', err))
      .finally(() => setLoadingAnalytics(false))
  }, [view, days, token])

  // Canlı görünüm hesaplamaları
  const lineChartData = densityData.slice(0, 20).reverse().map((d, i) => ({
    name: d.zone_id || `Zone ${i}`,
    avgSpeed: d.avg_speed,
    vehicleCount: d.vehicle_count,
  }))
  const vehicleTypes = densityData.reduce((acc, d) => {
    acc.bus = (acc.bus || 0) + d.bus
    acc.car = (acc.car || 0) + d.car
    acc.bike = (acc.bike || 0) + d.bike
    return acc
  }, {})
  const barData = [
    { name: 'Otobüs', value: vehicleTypes.bus || 0, color: '#3b82f6' },
    { name: 'Araba', value: vehicleTypes.car || 0, color: '#10b981' },
    { name: 'Bisiklet', value: vehicleTypes.bike || 0, color: '#f59e0b' },
  ]
  const avgSpeed = densityData.length > 0
    ? Math.round(densityData.reduce((sum, d) => sum + d.avg_speed, 0) / densityData.length)
    : 0
  const avgVehicles = densityData.length > 0
    ? Math.round(densityData.reduce((sum, d) => sum + d.vehicle_count, 0) / densityData.length)
    : 0

  // Analiz görünüm hesaplamaları
  const overallAvgVehicles = analytics.length
    ? (analytics.reduce((s, d) => s + d.avg_vehicles, 0) / analytics.length).toFixed(1)
    : 0
  const overallAvgSpeed = analytics.length
    ? (analytics.reduce((s, d) => s + d.avg_speed, 0) / analytics.length).toFixed(1)
    : 0
  const peakHour = analytics.reduce(
    (max, d) => Number(d.max_vehicles) > Number(max.max_vehicles || 0) ? d : max,
    analytics[0] || {}
  )
  const trendData = analytics.map(d => ({
    hour: formatHour(d.hour),
    'Ort. Araç': Math.round(d.avg_vehicles),
    'Ort. Hız (km/h)': Math.round(d.avg_speed),
  }))
  const vehicleTypeTotals = [
    { name: 'Otobüs', value: Math.round(analytics.reduce((s, d) => s + d.avg_bus, 0)), color: '#3b82f6' },
    { name: 'Araba', value: Math.round(analytics.reduce((s, d) => s + d.avg_car, 0)), color: '#10b981' },
    { name: 'Bisiklet', value: Math.round(analytics.reduce((s, d) => s + d.avg_bike, 0)), color: '#f59e0b' },
  ]
  const tickInterval = Math.max(1, Math.floor(trendData.length / 8))

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>📊 Yoğunluk</h2>
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
              <div className="label">Toplam Sinyal</div>
            </div>
            <div className="counter-box">
              <div className="value">{avgSpeed} km/h</div>
              <div className="label">Ort. Hız</div>
            </div>
            <div className="counter-box">
              <div className="value">{avgVehicles}</div>
              <div className="label">Ort. Araç</div>
            </div>
          </div>

          <div className="chart-container">
            <h3>Son 20 Bölge — Ortalama Hız</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
                <Line type="monotone" dataKey="avgSpeed" stroke="#3b82f6" name="Ort. Hız (km/h)" />
                <Line type="monotone" dataKey="vehicleCount" stroke="#10b981" name="Araç Sayısı" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3>Araç Tipi Dağılımı</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="value" name="Sayı">
                  {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3>Son {MAX_ITEMS} Bölge</h3>
            <table>
              <thead>
                <tr>
                  <th>Bölge</th><th>Araç</th><th>Ort. Hız</th>
                  <th>Otobüs</th><th>Araba</th><th>Bisiklet</th><th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {densityData.map((d, i) => (
                  <tr key={i}>
                    <td>{d.zone_id}</td>
                    <td>{d.vehicle_count}</td>
                    <td>{Math.round(d.avg_speed)} km/h</td>
                    <td>{d.bus}</td>
                    <td>{d.car}</td>
                    <td>{d.bike}</td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      {d._timestamp ? new Date(d._timestamp).toLocaleTimeString('tr-TR') : '-'}
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
                  <div className="value">{overallAvgVehicles}</div>
                  <div className="label">Ort. Araç Sayısı</div>
                </div>
                <div className="counter-box">
                  <div className="value">{overallAvgSpeed} km/h</div>
                  <div className="label">Ort. Hız</div>
                </div>
                <div className="counter-box">
                  <div className="value" style={{ color: '#f59e0b' }}>
                    {peakHour?.max_vehicles ? Math.round(peakHour.max_vehicles) : '-'}
                  </div>
                  <div className="label">En Yoğun Saat (Araç)</div>
                </div>
                <div className="counter-box">
                  <div className="value">{analytics.length}</div>
                  <div className="label">Saatlik Veri Noktası</div>
                </div>
              </div>

              <div className="chart-container">
                <h3>Saatlik Araç Sayısı ve Ortalama Hız Trendi</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={trendData}>
                    <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={tickInterval} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend />
                    <Line type="monotone" dataKey="Ort. Araç" stroke="#3b82f6" dot={false} />
                    <Line type="monotone" dataKey="Ort. Hız (km/h)" stroke="#10b981" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-container">
                <h3>Dönem Araç Tipi Toplamları</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={vehicleTypeTotals}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="value" name="Toplam">
                      {vehicleTypeTotals.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
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

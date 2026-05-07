import { useState, useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/AuthContext'

const MQTT_URL = import.meta.env.VITE_MQTT_URL || 'ws://localhost:8083/mqtt'
const TOPIC = 'telemetry/traffic_lights'
const MAX_ITEMS = 50
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const COLORS = { red: '#ef4444', green: '#22c55e', yellow: '#eab308' }

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
}

const formatHour = (iso) => {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`
}

export default function TrafficLights() {
  const { token } = useAuth()
  const [view, setView] = useState('live')
  const [days, setDays] = useState(7)
  const [analytics, setAnalytics] = useState([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const [lights, setLights] = useState([])
  const [connected, setConnected] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const clientRef = useRef(null)

  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clientId: 'dashboard-ui-traffic-' + Math.random().toString(16).slice(2, 8),
    })
    clientRef.current = client

    client.on('connect', () => {
      console.log('EMQX bağlantısı kuruldu (traffic_lights)')
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
        setLights(prev => [...batch, ...prev].slice(0, MAX_ITEMS))
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
    fetch(`${API_URL}/api/traffic/analytics?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setAnalytics(Array.isArray(data) ? data : []))
      .catch(err => console.error('Analytics fetch hatası:', err))
      .finally(() => setLoadingAnalytics(false))
  }, [view, days, token])

  // Canlı görünüm hesaplamaları
  const statusCount = lights.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1
    return acc
  }, {})
  const pieData = [
    { name: 'Kırmızı', value: statusCount.red || 0, color: COLORS.red },
    { name: 'Yeşil', value: statusCount.green || 0, color: COLORS.green },
    { name: 'Sarı', value: statusCount.yellow || 0, color: COLORS.yellow },
  ]
  const malfunctioningCount = lights.filter(l => l.is_malfunctioning === 1).length

  // Analiz görünüm hesaplamaları
  const totalMalfunctions = analytics.reduce((s, d) => s + Number(d.malfunction_count), 0)
  const totalEvents = analytics.reduce((s, d) => s + Number(d.total_events), 0)
  const peakRed = analytics.reduce((max, d) => Number(d.red_count) > Number(max.red_count || 0) ? d : max, analytics[0] || {})
  const chartData = analytics.map(d => ({
    hour: formatHour(d.hour),
    'Arıza': Number(d.malfunction_count),
    'Kırmızı': Number(d.red_count),
    'Yeşil': Number(d.green_count),
  }))
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8))

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>🚦 Trafik Işıkları</h2>
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
              <div className="value" style={{ color: COLORS.red }}>{statusCount.red || 0}</div>
              <div className="label">Kırmızı</div>
            </div>
            <div className="counter-box">
              <div className="value" style={{ color: COLORS.green }}>{statusCount.green || 0}</div>
              <div className="label">Yeşil</div>
            </div>
            <div className="counter-box">
              <div className="value" style={{ color: COLORS.yellow }}>{statusCount.yellow || 0}</div>
              <div className="label">Sarı</div>
            </div>
            <div className="counter-box">
              <div className="value" style={{ color: '#f87171' }}>{malfunctioningCount}</div>
              <div className="label">Arızalı</div>
            </div>
          </div>

          <div className="chart-container">
            <h3>Durum Dağılımı</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h3>Son {MAX_ITEMS} Sinyal</h3>
            <table>
              <thead>
                <tr>
                  <th>Lamp ID</th><th>Durum</th><th>Kalan Süre</th>
                  <th>Arızalı</th><th>Kavşak</th><th>Zaman</th>
                </tr>
              </thead>
              <tbody>
                {lights.map((l, i) => (
                  <tr key={i}>
                    <td>{l.lamp_id}</td>
                    <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                    <td>{l.timing_remains}s</td>
                    <td>
                      {l.is_malfunctioning === 1
                        ? <span className="badge over">Evet</span>
                        : <span className="badge north">Hayır</span>}
                    </td>
                    <td>{l.intersection_id}</td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      {l._timestamp ? new Date(l._timestamp).toLocaleTimeString('tr-TR') : '-'}
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
                  <div className="value">{totalEvents.toLocaleString('tr-TR')}</div>
                  <div className="label">Toplam Olay</div>
                </div>
                <div className="counter-box">
                  <div className="value" style={{ color: '#f87171' }}>{totalMalfunctions.toLocaleString('tr-TR')}</div>
                  <div className="label">Toplam Arıza</div>
                </div>
                <div className="counter-box">
                  <div className="value" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                    {peakRed?.hour ? formatHour(peakRed.hour) : '-'}
                  </div>
                  <div className="label">En Yoğun Kırmızı Saati</div>
                </div>
                <div className="counter-box">
                  <div className="value">{analytics.length}</div>
                  <div className="label">Saatlik Veri Noktası</div>
                </div>
              </div>

              <div className="chart-container">
                <h3>Saatlik Arıza ve Durum Dağılımı</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={tickInterval} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend />
                    <Line type="monotone" dataKey="Arıza" stroke="#f87171" dot={false} />
                    <Line type="monotone" dataKey="Kırmızı" stroke="#ef4444" dot={false} strokeOpacity={0.6} />
                    <Line type="monotone" dataKey="Yeşil" stroke="#22c55e" dot={false} strokeOpacity={0.6} />
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

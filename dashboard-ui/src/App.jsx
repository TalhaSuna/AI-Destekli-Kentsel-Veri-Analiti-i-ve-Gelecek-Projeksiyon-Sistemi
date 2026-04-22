import { useState, useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'

const MQTT_URL = 'ws://localhost:8083/mqtt'
const TOPIC = 'telemetry/speed_violations'
const MAX_ITEMS = 20 // Son 20 ihlali göster

export default function App() {
  const [violations, setViolations] = useState([])
  const [connected, setConnected] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const clientRef = useRef(null)

  useEffect(() => {
    // EMQX'e WebSocket ile bağlan
    const client = mqtt.connect(MQTT_URL, {
      clientId: 'dashboard-ui-' + Math.random().toString(16).slice(2, 8),
    })
    clientRef.current = client

    client.on('connect', () => {
      console.log('EMQX bağlantısı kuruldu')
      setConnected(true)
      // speed_violations topic'ine subscribe ol
      client.subscribe(TOPIC, (err) => {
        if (!err) console.log('Subscribe OK:', TOPIC)
      })
    })

    client.on('message', (topic, message) => {
      try {
        const batch = JSON.parse(message.toString())
        if (!Array.isArray(batch) || batch.length === 0) return

        setTotalCount(prev => prev + batch.length)

        // Yeni verileri ekle, son MAX_ITEMS kadarını tut
        setViolations(prev => {
          const updated = [...batch, ...prev]
          return updated.slice(0, MAX_ITEMS)
        })
      } catch (e) {
        console.error('Mesaj parse hatası:', e)
      }
    })

    client.on('close', () => setConnected(false))
    client.on('error', (err) => console.error('MQTT hata:', err))

    return () => {
      client.end()
    }
  }, [])

  // Grafik verisi: speed vs limit
  const chartData = violations.slice(0, 10).reverse().map((v, i) => ({
    name: v.vehicle_id || `#${i}`,
    speed: v.speed,
    limit: v.limit_val,
  }))

  // Ortalama hız
  const avgSpeed = violations.length > 0
    ? Math.round(violations.reduce((sum, v) => sum + v.speed, 0) / violations.length)
    : 0

  return (
    <div className="dashboard">
      <h1>🚨 Hız İhlalleri — Canlı Dashboard</h1>
      <p className={`status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '● EMQX bağlı — canlı veri akıyor' : '● Bağlantı bekleniyor...'}
      </p>

      {/* Sayaçlar */}
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

      {/* Bar Chart: Hız vs Limit */}
      <div className="chart-container">
        <h2>Son 10 İhlal — Hız vs Limit</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            <Bar dataKey="speed" fill="#f87171" name="Hız (km/h)" />
            <Bar dataKey="limit" fill="#4ade80" name="Limit (km/h)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tablo */}
      <div className="chart-container">
        <h2>Son {MAX_ITEMS} İhlal</h2>
        <table>
          <thead>
            <tr>
              <th>Araç</th>
              <th>Hız</th>
              <th>Limit</th>
              <th>Aşım</th>
              <th>Yön</th>
              <th>Zaman</th>
            </tr>
          </thead>
          <tbody>
            {violations.map((v, i) => (
              <tr key={i}>
                <td>{v.vehicle_id}</td>
                <td style={{ color: '#f87171', fontWeight: 700 }}>{v.speed} km/h</td>
                <td style={{ color: '#4ade80' }}>{v.limit_val} km/h</td>
                <td>
                  <span className="badge over">+{v.speed - v.limit_val} km/h</span>
                </td>
                <td>
                  <span className={`badge ${v.direction}`}>{v.direction}</span>
                </td>
                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                  {v._timestamp ? new Date(v._timestamp).toLocaleTimeString('tr-TR') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

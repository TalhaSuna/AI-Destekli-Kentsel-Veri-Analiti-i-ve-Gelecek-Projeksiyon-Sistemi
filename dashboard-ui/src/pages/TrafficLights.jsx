import { useState, useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const MQTT_URL = 'ws://localhost:8083/mqtt'
const TOPIC = 'telemetry/traffic_lights'
const MAX_ITEMS = 50

const COLORS = {
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
}

export default function TrafficLights() {
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

    client.on('message', (topic, message) => {
      try {
        const batch = JSON.parse(message.toString())
        if (!Array.isArray(batch) || batch.length === 0) return

        setTotalCount(prev => prev + batch.length)
        setLights(prev => {
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

  // Durum dağılımı
  const statusCount = lights.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1
    return acc
  }, {})

  const pieData = [
    { name: 'Kırmızı', value: statusCount.red || 0, color: COLORS.red },
    { name: 'Yeşil', value: statusCount.green || 0, color: COLORS.green },
    { name: 'Sarı', value: statusCount.yellow || 0, color: COLORS.yellow },
  ]

  // Arızalı sayısı
  const malfunctioningCount = lights.filter(l => l.is_malfunctioning === 1).length

  return (
    <div className="dashboard">
      <h2>🚦 Trafik Işıkları — Canlı Dashboard</h2>
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
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h3>Son {MAX_ITEMS} Sinyal</h3>
        <table>
          <thead>
            <tr>
              <th>Lamp ID</th>
              <th>Durum</th>
              <th>Kalan Süre</th>
              <th>Arızalı</th>
              <th>Kavşak</th>
              <th>Zaman</th>
            </tr>
          </thead>
          <tbody>
            {lights.map((l, i) => (
              <tr key={i}>
                <td>{l.lamp_id}</td>
                <td>
                  <span className={`badge ${l.status}`}>{l.status}</span>
                </td>
                <td>{l.timing_remains}s</td>
                <td>
                  {l.is_malfunctioning === 1 ? (
                    <span className="badge over">Evet</span>
                  ) : (
                    <span className="badge north">Hayır</span>
                  )}
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
    </div>
  )
}

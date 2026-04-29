import { useState, useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

const MQTT_URL = 'ws://localhost:8083/mqtt'
const TOPIC = 'telemetry/density'
const MAX_ITEMS = 50

export default function Density() {
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

    client.on('message', (topic, message) => {
      try {
        const batch = JSON.parse(message.toString())
        if (!Array.isArray(batch) || batch.length === 0) return

        setTotalCount(prev => prev + batch.length)
        setDensityData(prev => {
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

  // Line chart verisi: avg_speed zaman serisi
  const lineChartData = densityData.slice(0, 20).reverse().map((d, i) => ({
    name: d.zone_id || `Zone ${i}`,
    avgSpeed: d.avg_speed,
    vehicleCount: d.vehicle_count,
  }))

  // Bar chart verisi: araç tipi dağılımı
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

  // Ortalama değerler
  const avgSpeed = densityData.length > 0
    ? Math.round(densityData.reduce((sum, d) => sum + d.avg_speed, 0) / densityData.length)
    : 0
  const avgVehicles = densityData.length > 0
    ? Math.round(densityData.reduce((sum, d) => sum + d.vehicle_count, 0) / densityData.length)
    : 0

  return (
    <div className="dashboard">
      <h2>📊 Yoğunluk — Canlı Dashboard</h2>
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
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
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
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            <Bar dataKey="value" fill="#3b82f6" name="Sayı">
              {barData.map((entry, index) => (
                <rect key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h3>Son {MAX_ITEMS} Bölge</h3>
        <table>
          <thead>
            <tr>
              <th>Bölge</th>
              <th>Araç</th>
              <th>Ort. Hız</th>
              <th>Otobüs</th>
              <th>Araba</th>
              <th>Bisiklet</th>
              <th>Zaman</th>
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
    </div>
  )
}

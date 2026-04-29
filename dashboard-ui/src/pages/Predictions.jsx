import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

const AI_URL = 'http://localhost:8000'
const REFRESH_MS = 5 * 60 * 1000

const CHANNELS = [
  {
    id: 'density',
    name: 'Yoğunluk',
    icon: '📊',
    metrics: [
      { key: 'avg_vehicles', label: 'Ortalama Araç Sayısı', color: '#3b82f6' },
      { key: 'avg_speed',    label: 'Ortalama Hız (km/h)',  color: '#10b981' },
    ],
  },
  {
    id: 'traffic',
    name: 'Trafik Işıkları',
    icon: '🚦',
    metrics: [
      { key: 'malfunction_count', label: 'Arıza Sayısı',          color: '#f87171' },
      { key: 'red_count',         label: 'Kırmızı Işık Sayısı',   color: '#ef4444' },
    ],
  },
  {
    id: 'speed',
    name: 'Hız İhlalleri',
    icon: '🚨',
    metrics: [
      { key: 'violation_count', label: 'İhlal Sayısı',            color: '#f59e0b' },
      { key: 'avg_excess',      label: 'Ortalama Aşım (km/h)',    color: '#f97316' },
    ],
  },
]

function formatHour(str) {
  const d = new Date(str.replace(' ', 'T') + 'Z')
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function round1(v) { return Math.round(v * 10) / 10 }

function PredictionChart({ data, metric, color }) {
  const chartData = data
    .filter(d => d.metric === metric.key)
    .map(d => ({
      hour:      formatHour(d.hour),
      predicted: round1(d.predicted),
      upper:     round1(d.upper_bound),
      lower:     round1(d.lower_bound),
    }))

  if (chartData.length === 0) return null

  return (
    <div className="chart-container">
      <h3>{metric.label}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            interval={Math.floor(chartData.length / 8)}
          />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value, name) => {
              const labels = { predicted: 'Tahmin', upper: 'Üst sınır', lower: 'Alt sınır' }
              return [value, labels[name] || name]
            }}
          />
          {/* Güven bandı: upper'dan lower'ı çıkar, kalan bant görünür */}
          <Area type="monotone" dataKey="upper" fill={color} fillOpacity={0.15} stroke="none" legendType="none" />
          <Area type="monotone" dataKey="lower" fill="#1e293b"  fillOpacity={1}    stroke="none" legendType="none" />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke={color}
            strokeWidth={2}
            dot={false}
            name="Tahmin"
          />
          <Line type="monotone" dataKey="upper" stroke={color} strokeWidth={1} strokeDasharray="4 4" dot={false} name="Üst sınır" />
          <Line type="monotone" dataKey="lower" stroke={color} strokeWidth={1} strokeDasharray="4 4" dot={false} name="Alt sınır" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChannelSection({ channel, data, loading }) {
  if (loading) {
    return (
      <div className="chart-container" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        {channel.icon} {channel.name} yükleniyor...
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="chart-container" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚠️</div>
        <div>{channel.name} için tahmin yok.</div>
        <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
          Swagger'da <code>POST /api/predict-5min</code> çalıştır.
        </div>
      </div>
    )
  }

  const createdAt = data[0]?.created_at
  const nextUpdate = createdAt
    ? new Date(new Date(createdAt.replace(' ', 'T') + 'Z').getTime() + REFRESH_MS)
        .toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : '-'

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{channel.icon} {channel.name}</h2>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Son güncelleme: {createdAt ? formatHour(createdAt) : '-'} · Sonraki: ~{nextUpdate}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 16 }}>
        {channel.metrics.map(metric => (
          <PredictionChart key={metric.key} data={data} metric={metric} color={metric.color} />
        ))}
      </div>
    </div>
  )
}

export default function Predictions() {
  const [predictions, setPredictions] = useState({ density: [], traffic: [], speed: [] })
  const [loading, setLoading]         = useState({ density: true, traffic: true, speed: true })
  const [lastFetch, setLastFetch]     = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading({ density: true, traffic: true, speed: true })

    await Promise.all(
      CHANNELS.map(async ch => {
        try {
          const res  = await fetch(`${AI_URL}/api/predictions-5min/${ch.id}`)
          const json = await res.json()
          setPredictions(prev => ({ ...prev, [ch.id]: json.data || [] }))
        } catch (e) {
          console.error(`[Predictions] ${ch.id} fetch hatası:`, e)
          setPredictions(prev => ({ ...prev, [ch.id]: [] }))
        } finally {
          setLoading(prev => ({ ...prev, [ch.id]: false }))
        }
      })
    )
    setLastFetch(new Date())
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchAll])

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>🤖 Prophet Tahminleri — Sonraki 14 Saat</h2>
          <p className="status connected" style={{ margin: '4px 0 0' }}>
            Her 5 dakikada otomatik yenilenir
            {lastFetch && ` · Son çekim: ${lastFetch.toLocaleTimeString('tr-TR')}`}
          </p>
        </div>
        <button
          onClick={fetchAll}
          style={{
            background: '#3b82f6', color: 'white', border: 'none',
            borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.9rem',
          }}
        >
          ↻ Yenile
        </button>
      </div>

      {CHANNELS.map(ch => (
        <ChannelSection
          key={ch.id}
          channel={ch}
          data={predictions[ch.id]}
          loading={loading[ch.id]}
        />
      ))}
    </div>
  )
}

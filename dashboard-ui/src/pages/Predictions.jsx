import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from 'recharts'

const AI_URL = 'http://localhost:8000'
const REFRESH_MS = 5 * 60 * 1000

// UTC olarak gelen timestamp'i her zaman Türkiye saatine (UTC+3) çevirir
function formatHour(str) {
  const d = new Date(str.replace(' ', 'T') + 'Z')
  return d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

// Tooltip için tarih + saat (Türkiye saati)
function formatDatetimeTR(str) {
  const d = new Date(str.replace(' ', 'T') + 'Z')
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  })
}

function round1(v) { return Math.round(v * 10) / 10 }

// 168 nokta için her 12. etiket = her saat başı gösterilir
const XAXIS_INTERVAL = 11

function riskLevel(count) {
  if (count < 5)  return { label: 'Düşük',  color: '#4ade80', bg: 'rgba(74,222,128,0.12)' }
  if (count < 12) return { label: 'Orta',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' }
  return           { label: 'Yüksek', color: '#f87171', bg: 'rgba(248,113,113,0.12)' }
}

const tooltipStyle = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
  labelFormatter: (label, payload) =>
    payload?.[0]?.payload?.dt ? formatDatetimeTR(payload[0].payload.dt) : label,
}

// ─── Yoğunluk Bölümü ────────────────────────────────────────────────────────

function DensitySection({ data }) {
  const vehicles = data
    .filter(d => d.metric === 'avg_vehicles')
    .map(d => ({ dt: d.hour, hour: formatHour(d.hour), value: round1(d.predicted), upper: round1(d.upper_bound), lower: round1(d.lower_bound) }))

  const pedestrians = data
    .filter(d => d.metric === 'avg_pedestrians')
    .map(d => ({ dt: d.hour, hour: formatHour(d.hour), value: round1(d.predicted) }))

  const peakVehicle = vehicles.reduce((a, b) => (b.value > a.value ? b : a), { value: 0 })
  const totalForecast = vehicles.length

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>📊 Bölge Yoğunluk Tahmini</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>
          Nalçacı, Zafer, Merkez gibi bölgelerde önümüzdeki 14 saatte kaç araç ve yaya bekleniyor?
        </p>
      </div>

      {vehicles.length === 0 ? <EmptyState /> : <>
        <div className="counter" style={{ marginBottom: 20 }}>
          <StatBox label="Tahmin Aralığı" value="14 saat" color="#3b82f6" />
          <StatBox label="Tahminen En Yoğun Saat" value={peakVehicle.hour || '-'} color="#f59e0b" />
          <StatBox label="Zirve Araç Sayısı" value={Math.round(peakVehicle.value)} color="#f59e0b" />
          <StatBox label="Tahmin Noktası" value={totalForecast} color="#94a3b8" />
        </div>

        <div className="chart-container">
          <h3>Araç Sayısı Tahmini (5 dk aralıklar) — Güven Bandıyla</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={vehicles} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="gradVehicle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={XAXIS_INTERVAL} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
              <Tooltip {...tooltipStyle} formatter={v => [`${v} araç`, 'Tahmin']} />
              <Area type="monotone" dataKey="upper" fill="#3b82f6" fillOpacity={0.1} stroke="none" />
              <Area type="monotone" dataKey="lower" fill="#1e293b"  fillOpacity={1}   stroke="none" />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#gradVehicle)" name="Araç Sayısı" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {pedestrians.length > 0 && (
          <div className="chart-container">
            <h3>Yaya Sayısı Tahmini</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={pedestrians} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradPed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={XAXIS_INTERVAL} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
                <Tooltip {...tooltipStyle} formatter={v => [`${v} yaya`, 'Tahmin']} />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#gradPed)" name="Yaya Sayısı" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </>}
    </section>
  )
}

// ─── Hız İhlali / Risk Bölümü ────────────────────────────────────────────────

function SpeedSection({ data }) {
  const violations = data
    .filter(d => d.metric === 'violation_count')
    .map(d => {
      const risk = riskLevel(d.predicted)
      return {
        dt:    d.hour,
        hour:  formatHour(d.hour),
        count: round1(d.predicted),
        risk:  risk.label,
        color: risk.color,
        bg:    risk.bg,
      }
    })

  const highRisk = violations.filter(v => v.risk === 'Yüksek')
  const avgExcessData = data
    .filter(d => d.metric === 'avg_excess')
    .map(d => ({ dt: d.hour, hour: formatHour(d.hour), value: round1(d.predicted) }))

  const totalExpected = Math.round(violations.reduce((s, v) => s + v.count, 0))

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>🚨 Hız İhlali & Kaza Risk Tahmini</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>
          Hangi saatlerde hız limitleri daha çok aşılacak? Kaza riski en yüksek zaman dilimleri.
        </p>
      </div>

      {violations.length === 0 ? <EmptyState /> : <>
        <div className="counter" style={{ marginBottom: 20 }}>
          <StatBox label="Toplam Beklenen İhlal" value={totalExpected}               color="#f87171" />
          <StatBox label="Yüksek Riskli Dilim"   value={`${highRisk.length} × 5dk`} color="#f87171" />
          <StatBox label="Düşük Riskli Dilim"    value={`${violations.filter(v => v.risk === 'Düşük').length} × 5dk`} color="#4ade80" />
          <StatBox label="Risk Eşiği (5dk)"      value="> 12 ihlal = Yüksek"       color="#94a3b8" />
        </div>

        <div className="chart-container">
          <h3>Kaza Risk Takvimi — Her 5 Dakikada İhlal Tahmini</h3>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {[['Düşük', '#4ade80'], ['Orta', '#fbbf24'], ['Yüksek', '#f87171']].map(([label, color]) => (
              <span key={label} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label} Risk
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={violations} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={XAXIS_INTERVAL} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, _, props) => [`${v} ihlal — ${props.payload.risk} Risk`, 'Tahmin']}
              />
              <ReferenceLine y={12} stroke="#f87171" strokeDasharray="4 4" label={{ value: 'Yüksek risk eşiği', fill: '#f87171', fontSize: 11 }} />
              <ReferenceLine y={5}  stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Orta risk eşiği',   fill: '#fbbf24', fontSize: 11 }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {violations.map((v, i) => <Cell key={i} fill={v.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {avgExcessData.length > 0 && (
          <div className="chart-container">
            <h3>Ortalama Limit Aşımı Tahmini (km/h)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={avgExcessData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={XAXIS_INTERVAL} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
                <Tooltip {...tooltipStyle} formatter={v => [`${v} km/h`, 'Ort. Aşım']} />
                <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {highRisk.length > 0 && (
          <div className="chart-container">
            <h3>🔴 Yüksek Riskli Saatler</h3>
            <table>
              <thead>
                <tr><th>Saat</th><th>Tahmini İhlal</th><th>Risk</th></tr>
              </thead>
              <tbody>
                {highRisk.slice(0, 8).map((v, i) => (
                  <tr key={i}>
                    <td>{v.hour}</td>
                    <td>{v.count}</td>
                    <td><span className="badge over">{v.risk}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>}
    </section>
  )
}

// ─── Trafik Işığı / Arıza Bölümü ────────────────────────────────────────────

function TrafficSection({ data }) {
  const malfunctions = data
    .filter(d => d.metric === 'malfunction_count')
    .map(d => ({ dt: d.hour, hour: formatHour(d.hour), value: round1(d.predicted), upper: round1(d.upper_bound) }))

  const redCounts = data
    .filter(d => d.metric === 'red_count')
    .map(d => ({ dt: d.hour, hour: formatHour(d.hour), value: round1(d.predicted) }))

  const totalMalfunction = Math.round(malfunctions.reduce((s, d) => s + d.value, 0))
  const peakMalfunction  = malfunctions.reduce((a, b) => (b.value > a.value ? b : a), { value: 0 })
  const riskyHours = malfunctions.filter(d => d.value > peakMalfunction.value * 0.7)

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>🚦 Kavşak Arıza Tahmini</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>
          Trafik lambalarında önümüzdeki 14 saatte hangi saatlerde arıza riski yüksek?
        </p>
      </div>

      {malfunctions.length === 0 ? <EmptyState /> : <>
        <div className="counter" style={{ marginBottom: 20 }}>
          <StatBox label="Toplam Beklenen Arıza" value={totalMalfunction}                        color="#f87171" />
          <StatBox label="En Riskli Saat"        value={peakMalfunction.hour || '-'}             color="#f59e0b" />
          <StatBox label="Zirve Arıza Sayısı"    value={Math.round(peakMalfunction.value)}       color="#f59e0b" />
          <StatBox label="Riskli Dilim (>%70)"   value={`${riskyHours.length} × 5dk`}           color="#94a3b8" />
        </div>

        <div className="chart-container">
          <h3>Arıza Sayısı Tahmini — Güven Bandıyla</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={malfunctions} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="gradMalfunction" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={XAXIS_INTERVAL} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
              <Tooltip {...tooltipStyle} formatter={v => [`${v} arıza`, 'Tahmin']} />
              <Area type="monotone" dataKey="upper" fill="#f87171" fillOpacity={0.1} stroke="none" />
              <Area type="monotone" dataKey="value" stroke="#f87171" strokeWidth={2} fill="url(#gradMalfunction)" name="Arıza Sayısı" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {redCounts.length > 0 && (
          <div className="chart-container">
            <h3>Kırmızı Işık Sinyali Tahmini</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={redCounts} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={XAXIS_INTERVAL} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
                <Tooltip {...tooltipStyle} formatter={v => [`${v} sinyal`, 'Kırmızı Işık']} />
                <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </>}
    </section>
  )
}

// ─── Yardımcı Bileşenler ─────────────────────────────────────────────────────

function StatBox({ label, value, color }) {
  return (
    <div className="counter-box">
      <div className="value" style={{ color, fontSize: '1.5rem' }}>{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="chart-container" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
      <div>AI modeli tahminler hazırlıyor...</div>
      <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
        Servis ilk açılışta seed + eğitim yapıyor, 30-60 saniye içinde gelir.
      </div>
    </div>
  )
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function Predictions() {
  const [predictions, setPredictions] = useState({ density: [], traffic: [], speed: [] })
  const [lastFetch, setLastFetch]     = useState(null)
  const [loading, setLoading]         = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all(
      ['density', 'traffic', 'speed'].map(async ch => {
        try {
          const res  = await fetch(`${AI_URL}/api/predictions/${ch}`)
          const json = await res.json()
          setPredictions(prev => ({ ...prev, [ch]: json.data || [] }))
        } catch (e) {
          console.error(`[Predictions] ${ch}:`, e)
        }
      })
    )
    setLastFetch(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchAll])

  // Veri yoksa 10 saniyede bir tekrar dene (servis henüz hazırlıyor olabilir)
  useEffect(() => {
    const isEmpty = Object.values(predictions).every(arr => arr.length === 0)
    if (!isEmpty || loading) return
    const retryId = setInterval(fetchAll, 10_000)
    return () => clearInterval(retryId)
  }, [predictions, loading, fetchAll])

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h2 style={{ margin: 0 }}>🤖 Prophet AI Tahminleri — Önümüzdeki 14 Saat</h2>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>
            Her 5 dakikada otomatik güncellenir
            {lastFetch && ` · Son çekim: ${lastFetch.toLocaleTimeString('tr-TR')}`}
            {loading && ' · Yükleniyor...'}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          style={{
            background: loading ? '#334155' : '#3b82f6',
            color: 'white', border: 'none', borderRadius: 8,
            padding: '8px 20px', cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600, fontSize: '0.9rem', transition: 'background 0.2s',
          }}
        >
          {loading ? '...' : '↻ Yenile'}
        </button>
      </div>

      <DensitySection data={predictions.density} />
      <SpeedSection   data={predictions.speed} />
      <TrafficSection data={predictions.traffic} />
    </div>
  )
}

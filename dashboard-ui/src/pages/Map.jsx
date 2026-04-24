import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import mqtt from 'mqtt'

const MQTT_URL = 'ws://localhost:8083/mqtt'
const TOPICS = [
  'telemetry/traffic_lights',
  'telemetry/density',
  'telemetry/speed_violations',
]

const STATUS_COLORS = { red: '#ef4444', green: '#22c55e', yellow: '#eab308' }

export default function Map() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markersRef = useRef({ traffic: [], density: [], speed: [] })
  const [connected, setConnected] = useState(false)
  const [counts, setCounts] = useState({ traffic: 0, density: 0, speed: 0 })

  // Harita başlat
  useEffect(() => {
    if (map.current) return

    const KONYA = [32.4836, 37.8746]

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          { id: 'osm', type: 'raster', source: 'osm' },
        ],
      },
      center: KONYA,
      zoom: 12,
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // MQTT bağlantısı
  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clientId: 'dashboard-map-' + Math.random().toString(16).slice(2, 8),
    })

    client.on('connect', () => {
      setConnected(true)
      TOPICS.forEach(t => client.subscribe(t))
    })

    client.on('message', (topic, message) => {
      try {
        const batch = JSON.parse(message.toString())
        if (!Array.isArray(batch) || batch.length === 0 || !map.current) return

        if (topic.includes('traffic_lights')) {
          addTrafficMarkers(batch)
        } else if (topic.includes('density')) {
          addDensityMarkers(batch)
        } else if (topic.includes('speed_violations')) {
          addSpeedMarkers(batch)
        }
      } catch (e) {
        console.error('Parse hatası:', e)
      }
    })

    client.on('close', () => setConnected(false))

    return () => client.end()
  }, [])

  // Trafik ışıkları: renkli daireler
  function addTrafficMarkers(batch) {
    batch.forEach(item => {
      const el = document.createElement('div')
      el.style.width = '14px'
      el.style.height = '14px'
      el.style.borderRadius = '50%'
      el.style.backgroundColor = STATUS_COLORS[item.status] || '#94a3b8'
      el.style.border = item.is_malfunctioning === 1 ? '3px solid #f87171' : '2px solid white'
      el.title = `Lamp: ${item.lamp_id} | Durum: ${item.status} | Kavşak: ${item.intersection_id}`

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lng, item.lat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(
          `<div style="color:#0f172a">
            <b>🚦 ${item.lamp_id}</b><br/>
            Durum: <b style="color:${STATUS_COLORS[item.status]}">${item.status}</b><br/>
            Kalan: ${item.timing_remains}s<br/>
            Arızalı: ${item.is_malfunctioning === 1 ? '⚠️ Evet' : 'Hayır'}<br/>
            Kavşak: ${item.intersection_id}
          </div>`
        ))
        .addTo(map.current)

      markersRef.current.traffic.push(marker)
      if (markersRef.current.traffic.length > 100) {
        markersRef.current.traffic.shift().remove()
      }
    })
    setCounts(prev => ({ ...prev, traffic: prev.traffic + batch.length }))
  }

  // Yoğunluk: büyüklüğü değişen mavi daireler
  function addDensityMarkers(batch) {
    batch.forEach(item => {
      const size = Math.min(8 + item.vehicle_count * 2, 40)
      const el = document.createElement('div')
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      el.style.borderRadius = '50%'
      el.style.backgroundColor = 'rgba(59, 130, 246, 0.6)'
      el.style.border = '2px solid rgba(59, 130, 246, 0.9)'
      el.title = `Bölge: ${item.zone_id} | Araç: ${item.vehicle_count}`

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lng, item.lat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(
          `<div style="color:#0f172a">
            <b>📊 ${item.zone_id}</b><br/>
            Araç: ${item.vehicle_count} | Yaya: ${item.pedestrian_count}<br/>
            Ort. Hız: ${Math.round(item.avg_speed)} km/h<br/>
            🚌 ${item.bus} | 🚗 ${item.car} | 🚲 ${item.bike}
          </div>`
        ))
        .addTo(map.current)

      markersRef.current.density.push(marker)
      if (markersRef.current.density.length > 100) {
        markersRef.current.density.shift().remove()
      }
    })
    setCounts(prev => ({ ...prev, density: prev.density + batch.length }))
  }

  // Hız ihlalleri: kırmızı noktalar
  function addSpeedMarkers(batch) {
    batch.forEach(item => {
      const el = document.createElement('div')
      el.style.width = '12px'
      el.style.height = '12px'
      el.style.borderRadius = '50%'
      el.style.backgroundColor = '#ef4444'
      el.style.border = '2px solid white'
      el.title = `${item.vehicle_id} | ${item.speed} km/h`

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([item.lng, item.lat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(
          `<div style="color:#0f172a">
            <b>🚨 ${item.vehicle_id}</b><br/>
            Hız: <b style="color:#ef4444">${item.speed} km/h</b><br/>
            Limit: ${item.limit_val} km/h<br/>
            Aşım: +${item.speed - item.limit_val} km/h<br/>
            Yön: ${item.direction}
          </div>`
        ))
        .addTo(map.current)

      markersRef.current.speed.push(marker)
      if (markersRef.current.speed.length > 100) {
        markersRef.current.speed.shift().remove()
      }
    })
    setCounts(prev => ({ ...prev, speed: prev.speed + batch.length }))
  }

  return (
    <div className="dashboard">
      <h2>🗺️ Canlı Harita — Konya</h2>
      <p className={`status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? '● EMQX bağlı — canlı veri akıyor' : '● Bağlantı bekleniyor...'}
      </p>
      <div className="counter">
        <div className="counter-box">
          <div className="value" style={{ color: '#22c55e' }}>{counts.traffic}</div>
          <div className="label">🚦 Trafik Işığı</div>
        </div>
        <div className="counter-box">
          <div className="value" style={{ color: '#3b82f6' }}>{counts.density}</div>
          <div className="label">📊 Yoğunluk</div>
        </div>
        <div className="counter-box">
          <div className="value" style={{ color: '#ef4444' }}>{counts.speed}</div>
          <div className="label">🚨 Hız İhlali</div>
        </div>
      </div>
      <div ref={mapContainer} className="map-container" style={{ background: '#1e293b' }} />
    </div>
  )
}

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import mqtt from 'mqtt'

const MQTT_URL = 'ws://localhost:8083/mqtt'
const TOPICS = ['telemetry/traffic_lights', 'telemetry/density', 'telemetry/speed_violations']
const MAX_FEATURES = 300

const toGeoJSON = (features) => ({ type: 'FeatureCollection', features })

export default function Map() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const mapReady = useRef(false)
  const featuresRef = useRef({ traffic: [], density: [], speed: [] })
  const pendingRef = useRef({ traffic: [], density: [], speed: [] })
  const pendingCountsRef = useRef({ traffic: 0, density: 0, speed: 0 })
  const rafRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [counts, setCounts] = useState({ traffic: 0, density: 0, speed: 0 })

  useEffect(() => {
    if (map.current) return

    const m = new maplibregl.Map({
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
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [32.4836, 37.8746],
      zoom: 12,
    })

    map.current = m

    m.on('load', () => {
      // Trafik ışıkları: renkli daireler, arızalı = kırmızı çerçeve
      m.addSource('traffic-source', { type: 'geojson', data: toGeoJSON([]) })
      m.addLayer({
        id: 'traffic-layer',
        type: 'circle',
        source: 'traffic-source',
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'match', ['get', 'status'],
            'red',    '#ef4444',
            'green',  '#22c55e',
            'yellow', '#eab308',
            '#94a3b8'
          ],
          'circle-stroke-width': ['case', ['==', ['get', 'is_malfunctioning'], 1], 3, 2],
          'circle-stroke-color': ['case', ['==', ['get', 'is_malfunctioning'], 1], '#f87171', '#ffffff'],
        }
      })

      // Yoğunluk: araç sayısına göre büyüyen mavi daireler
      m.addSource('density-source', { type: 'geojson', data: toGeoJSON([]) })
      m.addLayer({
        id: 'density-layer',
        type: 'circle',
        source: 'density-source',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'vehicle_count'], 0, 6, 50, 22],
          'circle-color': 'rgba(59, 130, 246, 0.6)',
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(59, 130, 246, 0.9)',
        }
      })

      // Hız ihlalleri: kırmızı üçgen sembol
      m.addSource('speed-source', { type: 'geojson', data: toGeoJSON([]) })
      m.addLayer({
        id: 'speed-layer',
        type: 'symbol',
        source: 'speed-source',
        layout: {
          'text-field': '▲',
          'text-size': 16,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ef4444',
          'text-halo-color': 'rgba(0,0,0,0.5)',
          'text-halo-width': 1,
        }
      })

      // Popup'lar
      m.on('click', 'traffic-layer', (e) => {
        const p = e.features[0].properties
        const color = p.status === 'red' ? '#ef4444' : p.status === 'green' ? '#22c55e' : '#eab308'
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<div style="color:#0f172a">
            <b>🚦 ${p.lamp_id}</b><br/>
            Durum: <b style="color:${color}">${p.status}</b><br/>
            Kalan: ${p.timing_remains}s<br/>
            Arızalı: ${p.is_malfunctioning === 1 ? '⚠️ Evet' : 'Hayır'}<br/>
            Kavşak: ${p.intersection_id}
          </div>`)
          .addTo(m)
      })

      m.on('click', 'density-layer', (e) => {
        const p = e.features[0].properties
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<div style="color:#0f172a">
            <b>📊 ${p.zone_id}</b><br/>
            Araç: ${p.vehicle_count}<br/>
            Ort. Hız: ${Math.round(p.avg_speed)} km/h<br/>
            🚌 ${p.bus} | 🚗 ${p.car} | 🚲 ${p.bike}
          </div>`)
          .addTo(m)
      })

      m.on('click', 'speed-layer', (e) => {
        const p = e.features[0].properties
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`<div style="color:#0f172a">
            <b>🚨 ${p.vehicle_id}</b><br/>
            Hız: <b style="color:#ef4444">${p.speed} km/h</b><br/>
            Limit: ${p.limit_val} km/h<br/>
            Aşım: +${p.speed - p.limit_val} km/h<br/>
            Yön: ${p.direction}
          </div>`)
          .addTo(m)
      })

      ;['traffic-layer', 'density-layer', 'speed-layer'].forEach(layer => {
        m.on('mouseenter', layer, () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = '' })
      })

      mapReady.current = true
    })

    return () => {
      mapReady.current = false
      m.remove()
      map.current = null
    }
  }, [])

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
        if (!Array.isArray(batch) || batch.length === 0 || !mapReady.current) return

        if (topic.includes('traffic_lights'))    queueUpdate('traffic', batch, trafficFeature)
        else if (topic.includes('density'))      queueUpdate('density', batch, densityFeature)
        else if (topic.includes('speed'))        queueUpdate('speed',   batch, speedFeature)
      } catch (e) {
        console.error('Parse hatası:', e)
      }
    })

    client.on('close', () => setConnected(false))
    return () => client.end()
  }, [])

  function queueUpdate(key, batch, toFeature) {
    pendingRef.current[key].push(...batch.map(toFeature))
    pendingCountsRef.current[key] += batch.length
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(flushToMap)
    }
  }

  function flushToMap() {
    rafRef.current = null
    if (!map.current || !mapReady.current) return

    const addedCounts = { traffic: 0, density: 0, speed: 0 }

    const flush = (key, sourceId) => {
      const pending = pendingRef.current[key]
      if (pending.length === 0) return
      const arr = featuresRef.current[key]
      arr.push(...pending)
      if (arr.length > MAX_FEATURES) arr.splice(0, arr.length - MAX_FEATURES)
      map.current.getSource(sourceId).setData(toGeoJSON(arr))
      addedCounts[key] = pendingCountsRef.current[key]
      pendingRef.current[key] = []
      pendingCountsRef.current[key] = 0
    }

    flush('traffic', 'traffic-source')
    flush('density', 'density-source')
    flush('speed',   'speed-source')

    setCounts(prev => ({
      traffic: prev.traffic + addedCounts.traffic,
      density: prev.density + addedCounts.density,
      speed:   prev.speed   + addedCounts.speed,
    }))
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

const trafficFeature = (item) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
  properties: {
    lamp_id: item.lamp_id,
    status: item.status,
    timing_remains: item.timing_remains,
    is_malfunctioning: item.is_malfunctioning,
    intersection_id: item.intersection_id,
  }
})

const densityFeature = (item) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
  properties: {
    zone_id: item.zone_id,
    vehicle_count: item.vehicle_count,
    avg_speed: item.avg_speed,
    bus: item.bus,
    car: item.car,
    bike: item.bike,
  }
})

const speedFeature = (item) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
  properties: {
    vehicle_id: item.vehicle_id,
    speed: item.speed,
    limit_val: item.limit_val,
    direction: item.direction,
  }
})

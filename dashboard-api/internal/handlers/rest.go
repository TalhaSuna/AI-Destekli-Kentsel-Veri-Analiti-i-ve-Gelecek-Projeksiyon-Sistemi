package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"dashboard-api/internal/models"

	ch "github.com/ClickHouse/clickhouse-go/v2"
)

// RestHandler frontend ilk açıldığında geçmiş verileri döner.
// Frontend bu endpoint'leri 1 kez çağırır, sonra EMQX'ten canlı veriyi dinler.
type RestHandler struct {
	DB ch.Conn
}

// GetTrafficHistory tüm trafik ışığı verilerini zamana göre sıralı döner.
func (h *RestHandler) GetTrafficHistory(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(context.Background(), `
		SELECT lamp_id, status, timing_remains, is_malfunctioning,
			   intersection_id, lat, lng, _timestamp
		FROM traffic_lights ORDER BY _timestamp ASC
	`)
	if err != nil {
		log.Printf("ClickHouse sorgu hatası: %v", err)
		http.Error(w, "Sorgu hatası", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []models.TrafficLight
	for rows.Next() {
		var row models.TrafficLight
		if err := rows.ScanStruct(&row); err != nil {
			log.Printf("traffic_lights scan hatası: %v", err)
			continue
		}
		results = append(results, row)
	}

	respondJSON(w, results)
}

// GetDensityHistory tüm yoğunluk verilerini zamana göre sıralı döner.
func (h *RestHandler) GetDensityHistory(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(context.Background(), `
		SELECT zone_id, vehicle_count, pedestrian_count, avg_speed,
			   bus, car, bike, lat, lng, timestamp, _timestamp
		FROM density ORDER BY _timestamp ASC
	`)
	if err != nil {
		log.Printf("ClickHouse sorgu hatası: %v", err)
		http.Error(w, "Sorgu hatası", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []models.Density
	for rows.Next() {
		var row models.Density
		if err := rows.ScanStruct(&row); err != nil {
			log.Printf("density scan hatası: %v", err)
			continue
		}
		results = append(results, row)
	}

	respondJSON(w, results)
}

// GetSpeedHistory tüm hız ihlali verilerini zamana göre sıralı döner.
func (h *RestHandler) GetSpeedHistory(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(context.Background(), `
		SELECT vehicle_id, speed, limit_val, lane_id, direction,
			   lat, lng, _timestamp
		FROM speed_violations ORDER BY _timestamp ASC
	`)
	if err != nil {
		log.Printf("ClickHouse sorgu hatası: %v", err)
		http.Error(w, "Sorgu hatası", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []models.SpeedViolation
	for rows.Next() {
		var row models.SpeedViolation
		if err := rows.ScanStruct(&row); err != nil {
			log.Printf("speed_violations scan hatası: %v", err)
			continue
		}
		results = append(results, row)
	}

	respondJSON(w, results)
}

// respondJSON CORS header'ları ekleyip JSON response yazar.
func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(data)
}

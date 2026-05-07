package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"dashboard-api/internal/models"

	ch "github.com/ClickHouse/clickhouse-go/v2"
)

type RestHandler struct {
	DB ch.Conn
}

// parseDays ?days=N query parametresini okur; geçersizse varsayılan 7, max 30.
func parseDays(r *http.Request) int {
	days, err := strconv.Atoi(r.URL.Query().Get("days"))
	if err != nil || days < 1 {
		return 7
	}
	if days > 30 {
		return 30
	}
	return days
}

// GetTrafficAnalytics son N günün trafik ışığı verilerini saatlik aggregate olarak döner.
func (h *RestHandler) GetTrafficAnalytics(w http.ResponseWriter, r *http.Request) {
	days := parseDays(r)

	query := fmt.Sprintf(`
		SELECT
			toStartOfHour(_timestamp)       AS hour,
			countIf(is_malfunctioning = 1)  AS malfunction_count,
			countIf(status = 'red')         AS red_count,
			countIf(status = 'green')       AS green_count,
			countIf(status = 'yellow')      AS yellow_count,
			count()                         AS total_events
		FROM traffic_lights
		WHERE _timestamp >= now() - INTERVAL %d DAY
		GROUP BY hour
		ORDER BY hour ASC
	`, days)

	rows, err := h.DB.Query(context.Background(), query)
	if err != nil {
		log.Printf("traffic analytics sorgu hatası: %v", err)
		http.Error(w, "Sorgu hatası", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []models.TrafficAnalytics
	for rows.Next() {
		var row models.TrafficAnalytics
		if err := rows.ScanStruct(&row); err != nil {
			log.Printf("traffic analytics scan hatası: %v", err)
			continue
		}
		results = append(results, row)
	}

	respondJSON(w, results)
}

// GetDensityAnalytics son N günün yoğunluk verilerini saatlik aggregate olarak döner.
func (h *RestHandler) GetDensityAnalytics(w http.ResponseWriter, r *http.Request) {
	days := parseDays(r)

	query := fmt.Sprintf(`
		SELECT
			toStartOfHour(_timestamp)  AS hour,
			avg(vehicle_count)         AS avg_vehicles,
			avg(avg_speed)             AS avg_speed,
			avg(bus)                   AS avg_bus,
			avg(car)                   AS avg_car,
			avg(bike)                  AS avg_bike,
			toUInt64(max(vehicle_count)) AS max_vehicles
		FROM density
		WHERE _timestamp >= now() - INTERVAL %d DAY
		GROUP BY hour
		ORDER BY hour ASC
	`, days)

	rows, err := h.DB.Query(context.Background(), query)
	if err != nil {
		log.Printf("density analytics sorgu hatası: %v", err)
		http.Error(w, "Sorgu hatası", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []models.DensityAnalytics
	for rows.Next() {
		var row models.DensityAnalytics
		if err := rows.ScanStruct(&row); err != nil {
			log.Printf("density analytics scan hatası: %v", err)
			continue
		}
		results = append(results, row)
	}

	respondJSON(w, results)
}

// GetSpeedAnalytics son N günün hız ihlali verilerini saatlik aggregate olarak döner.
func (h *RestHandler) GetSpeedAnalytics(w http.ResponseWriter, r *http.Request) {
	days := parseDays(r)

	query := fmt.Sprintf(`
		SELECT
			toStartOfHour(_timestamp)      AS hour,
			count()                        AS violation_count,
			avg(speed - limit_val)         AS avg_excess,
			toFloat64(max(speed - limit_val)) AS max_excess,
			avg(speed)                     AS avg_speed
		FROM speed_violations
		WHERE _timestamp >= now() - INTERVAL %d DAY
		GROUP BY hour
		ORDER BY hour ASC
	`, days)

	rows, err := h.DB.Query(context.Background(), query)
	if err != nil {
		log.Printf("speed analytics sorgu hatası: %v", err)
		http.Error(w, "Sorgu hatası", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []models.SpeedAnalytics
	for rows.Next() {
		var row models.SpeedAnalytics
		if err := rows.ScanStruct(&row); err != nil {
			log.Printf("speed analytics scan hatası: %v", err)
			continue
		}
		results = append(results, row)
	}

	respondJSON(w, results)
}

func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(data)
}

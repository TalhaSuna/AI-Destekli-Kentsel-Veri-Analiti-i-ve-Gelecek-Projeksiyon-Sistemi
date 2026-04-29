package streamer

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"dashboard-api/config"
	"dashboard-api/internal/models"
	mqttclient "dashboard-api/internal/mqtt"

	ch "github.com/ClickHouse/clickhouse-go/v2"
)

const batchLimit = 500

type Streamer struct {
	db        ch.Conn
	publisher *mqttclient.Publisher
	interval  time.Duration
}

func NewStreamer(db ch.Conn, pub *mqttclient.Publisher, cfg *config.AppConfig) *Streamer {
	return &Streamer{
		db:        db,
		publisher: pub,
		interval:  time.Duration(cfg.PollIntervalMS) * time.Millisecond,
	}
}

func (s *Streamer) Start(ctx context.Context) {
	lastTimes := map[string]time.Time{
		"traffic_lights":   time.Now().UTC(),
		"density":          time.Now().UTC(),
		"speed_violations": time.Now().UTC(),
	}

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	log.Printf("Streamer başlatıldı: her %v aralıkla ClickHouse → EMQX", s.interval)

	for {
		select {
		case <-ctx.Done():
			log.Println("Streamer durduruluyor...")
			return
		case <-ticker.C:
			s.pollTraffic(ctx, lastTimes)
			s.pollDensity(ctx, lastTimes)
			s.pollSpeed(ctx, lastTimes)
		}
	}
}

func (s *Streamer) pollTraffic(ctx context.Context, lastTimes map[string]time.Time) {
	query := `SELECT lamp_id, status, timing_remains, is_malfunctioning,
			  intersection_id, lat, lng, _timestamp
			  FROM traffic_lights
			  WHERE _timestamp > @last
			  ORDER BY _timestamp ASC
			  LIMIT @limit`

	queryCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	rows, err := s.db.Query(queryCtx, query,
		ch.Named("last", lastTimes["traffic_lights"]),
		ch.Named("limit", batchLimit),
	)
	if err != nil {
		log.Printf("[Streamer] traffic_lights sorgu hatası: %v", err)
		return
	}
	defer rows.Close()

	var batch []models.TrafficLight
	for rows.Next() {
		var row models.TrafficLight
		if err := rows.ScanStruct(&row); err != nil {
			log.Printf("[Streamer] traffic_lights scan hatası: %v", err)
			continue
		}
		batch = append(batch, row)
	}

	if publish(s.publisher, "traffic_lights", batch) && len(batch) > 0 {
		lastTimes["traffic_lights"] = batch[len(batch)-1].Timestamp
	}
}

func (s *Streamer) pollDensity(ctx context.Context, lastTimes map[string]time.Time) {
	query := `SELECT zone_id, vehicle_count, pedestrian_count, avg_speed,
			  bus, car, bike, lat, lng, timestamp, _timestamp
			  FROM density
			  WHERE _timestamp > @last
			  ORDER BY _timestamp ASC
			  LIMIT @limit`

	queryCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	rows, err := s.db.Query(queryCtx, query,
		ch.Named("last", lastTimes["density"]),
		ch.Named("limit", batchLimit),
	)
	if err != nil {
		log.Printf("[Streamer] density sorgu hatası: %v", err)
		return
	}
	defer rows.Close()

	var batch []models.Density
	for rows.Next() {
		var row models.Density
		if err := rows.ScanStruct(&row); err != nil {
			log.Printf("[Streamer] density scan hatası: %v", err)
			continue
		}
		batch = append(batch, row)
	}

	if publish(s.publisher, "density", batch) && len(batch) > 0 {
		lastTimes["density"] = batch[len(batch)-1].Timestamp
	}
}

func (s *Streamer) pollSpeed(ctx context.Context, lastTimes map[string]time.Time) {
	query := `SELECT vehicle_id, speed, limit_val, lane_id, direction,
			  lat, lng, _timestamp
			  FROM speed_violations
			  WHERE _timestamp > @last
			  ORDER BY _timestamp ASC
			  LIMIT @limit`

	queryCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	rows, err := s.db.Query(queryCtx, query,
		ch.Named("last", lastTimes["speed_violations"]),
		ch.Named("limit", batchLimit),
	)
	if err != nil {
		log.Printf("[Streamer] speed_violations sorgu hatası: %v", err)
		return
	}
	defer rows.Close()

	var batch []models.SpeedViolation
	for rows.Next() {
		var row models.SpeedViolation
		if err := rows.ScanStruct(&row); err != nil {
			log.Printf("[Streamer] speed_violations scan hatası: %v", err)
			continue
		}
		batch = append(batch, row)
	}

	if publish(s.publisher, "speed_violations", batch) && len(batch) > 0 {
		lastTimes["speed_violations"] = batch[len(batch)-1].Timestamp
	}
}

// publish JSON'a çevirip EMQX'e gönderir, başarı durumunu döndürür.
func publish(pub *mqttclient.Publisher, name string, batch interface{}) bool {
	data, err := json.Marshal(batch)
	if err != nil {
		log.Printf("[Streamer] %s JSON hatası: %v", name, err)
		return false
	}

	if string(data) == "null" || string(data) == "[]" {
		return false
	}

	if err := pub.Publish(name, data); err != nil {
		log.Printf("[Streamer] %s publish hatası: %v", name, err)
		return false
	}

	log.Printf("[Streamer] %s → EMQX'e gönderildi", name)
	return true
}

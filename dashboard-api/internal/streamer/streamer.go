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

// Streamer her X ms'de ClickHouse'dan yeni verileri çeker
// ve EMQX'e publish eder.
// Akış: ClickHouse → Streamer → EMQX → Frontend
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

// Start her interval'de ClickHouse'dan yeni verileri çekip EMQX'e publish eder.
// context iptal edilene kadar çalışmaya devam eder.
func (s *Streamer) Start(ctx context.Context) {
	// Her tablo için son okunan zamanı tut.
	// Böylece sadece yeni verileri çekeriz — aynı veriyi tekrar göndermeyiz.
	lastTimes := map[string]time.Time{
		"traffic_lights":  time.Now().UTC(),
		"density":         time.Now().UTC(),
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

// pollTraffic traffic_lights tablosundan yeni verileri çeker ve EMQX'e gönderir.
func (s *Streamer) pollTraffic(ctx context.Context, lastTimes map[string]time.Time) {
	query := `SELECT lamp_id, status, timing_remains, is_malfunctioning,
			  intersection_id, lat, lng, _timestamp
			  FROM traffic_lights WHERE _timestamp > @last ORDER BY _timestamp ASC`

	rows, err := s.db.Query(ctx, query, ch.Named("last", lastTimes["traffic_lights"]))
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

	s.publishBatch("traffic_lights", batch, lastTimes)
}

// pollDensity density tablosundan yeni verileri çeker ve EMQX'e gönderir.
func (s *Streamer) pollDensity(ctx context.Context, lastTimes map[string]time.Time) {
	query := `SELECT zone_id, vehicle_count, pedestrian_count, avg_speed,
			  bus, car, bike, lat, lng, timestamp, _timestamp
			  FROM density WHERE _timestamp > @last ORDER BY _timestamp ASC`

	rows, err := s.db.Query(ctx, query, ch.Named("last", lastTimes["density"]))
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

	s.publishBatch("density", batch, lastTimes)
}

// pollSpeed speed_violations tablosundan yeni verileri çeker ve EMQX'e gönderir.
func (s *Streamer) pollSpeed(ctx context.Context, lastTimes map[string]time.Time) {
	query := `SELECT vehicle_id, speed, limit_val, lane_id, direction,
			  lat, lng, _timestamp
			  FROM speed_violations WHERE _timestamp > @last ORDER BY _timestamp ASC`

	rows, err := s.db.Query(ctx, query, ch.Named("last", lastTimes["speed_violations"]))
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

	s.publishBatch("speed_violations", batch, lastTimes)
}

// publishBatch batch'i JSON'a çevirip EMQX'e gönderir ve lastTime'ı günceller.
func (s *Streamer) publishBatch(name string, batch interface{}, lastTimes map[string]time.Time) {
	data, err := json.Marshal(batch)
	if err != nil {
		log.Printf("[Streamer] %s JSON hatası: %v", name, err)
		return
	}

	// Boş batch kontrolü — "null" veya "[]" ise gönderme
	if string(data) == "null" || string(data) == "[]" {
		return
	}

	if err := s.publisher.Publish(name, data); err != nil {
		log.Printf("[Streamer] %s publish hatası: %v", name, err)
		return
	}

	lastTimes[name] = time.Now().UTC()
	log.Printf("[Streamer] %s → EMQX'e gönderildi", name)
}

package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"dashboard-api/config"
	chclient "dashboard-api/internal/clickhouse"
	"dashboard-api/internal/handlers"
	"dashboard-api/internal/middleware"
	mqttclient "dashboard-api/internal/mqtt"
	"dashboard-api/internal/streamer"
)

func corsHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	// 1. Konfigürasyon yükle
	cfg := config.LoadConfig()

	// 2. ClickHouse'a bağlan — veri kaynağımız
	db, err := chclient.NewClient(cfg)
	if err != nil {
		log.Fatalf("ClickHouse bağlantısı kurulamadı: %v", err)
	}
	defer db.Close()

	// 3. EMQX'e bağlan — canlı veriyi buraya publish edeceğiz
	pub, err := mqttclient.NewPublisher(cfg)
	if err != nil {
		log.Fatalf("EMQX bağlantısı kurulamadı: %v", err)
	}
	defer pub.Close()

	// 4. Streamer başlat — her 1 sn'de ClickHouse → EMQX
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	str := streamer.NewStreamer(db, pub, cfg)
	go str.Start(ctx)

	// 5. RS256 public key yükle — auth-service'in ürettiği
	pubKey, err := middleware.LoadPublicKey(cfg.JWTPublicKeyPath)
	if err != nil {
		log.Fatalf("JWT public key yüklenemedi: %v", err)
	}
	log.Printf("JWT public key yüklendi: %s", cfg.JWTPublicKeyPath)

	// 6. REST endpoint'leri — her biri JWT + permission ile korunuyor
	// GET /api/traffic/analytics?days=N  (varsayılan 7, max 30)
	// GET /api/density/analytics?days=N
	// GET /api/speed/analytics?days=N
	rest := &handlers.RestHandler{DB: db}
	http.HandleFunc("/api/traffic/analytics", middleware.Protect(pubKey, "view_traffic", rest.GetTrafficAnalytics))
	http.HandleFunc("/api/density/analytics", middleware.Protect(pubKey, "view_density", rest.GetDensityAnalytics))
	http.HandleFunc("/api/speed/analytics", middleware.Protect(pubKey, "view_speed", rest.GetSpeedAnalytics))

	// 7. HTTP sunucuyu başlat
	log.Printf("Dashboard API başlatıldı: http://localhost:%s", cfg.ServerPort)
	go func() {
		if err := http.ListenAndServe(":"+cfg.ServerPort, corsHandler(http.DefaultServeMux)); err != nil {
			log.Fatalf("HTTP sunucu hatası: %v", err)
		}
	}()

	// 8. Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Kapatma sinyali alındı...")
	cancel()
	log.Println("Dashboard API durduruldu.")
}

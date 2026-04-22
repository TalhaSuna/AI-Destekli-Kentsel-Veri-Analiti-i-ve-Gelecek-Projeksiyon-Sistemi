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
	mqttclient "dashboard-api/internal/mqtt"
	"dashboard-api/internal/streamer"
)

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

	// 5. REST endpoint'lerini tanımla — geçmiş veri için
	rest := &handlers.RestHandler{DB: db}
	http.HandleFunc("/api/traffic/history", rest.GetTrafficHistory)
	http.HandleFunc("/api/density/history", rest.GetDensityHistory)
	http.HandleFunc("/api/speed/history", rest.GetSpeedHistory)

	// 6. HTTP sunucuyu başlat
	log.Printf("Dashboard API başlatıldı: http://localhost:%s", cfg.ServerPort)
	go func() {
		if err := http.ListenAndServe(":"+cfg.ServerPort, nil); err != nil {
			log.Fatalf("HTTP sunucu hatası: %v", err)
		}
	}()

	// 7. Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Kapatma sinyali alındı...")
	cancel()
	log.Println("Dashboard API durduruldu.")
}

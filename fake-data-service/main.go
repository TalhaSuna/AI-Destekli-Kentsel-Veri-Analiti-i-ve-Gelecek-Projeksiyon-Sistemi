package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"fake-data-service/config"
	"fake-data-service/generators"
	redisclient "fake-data-service/redis"

	"github.com/redis/go-redis/v9"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config yüklenemedi: %v", err)
	}

	client, err := redisclient.NewClient(cfg)
	if err != nil {
		log.Fatalf("Redis bağlantısı kurulamadı: %v", err)
	}
	defer client.Close()

	log.Printf("Redis bağlantısı başarılı: %s", cfg.RedisAddr())
	log.Printf("Her kanal için saniyede %d veri üretilecek (toplam %d/s)",
		cfg.PublishRatePerChannel, cfg.PublishRatePerChannel*3)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	var wg sync.WaitGroup
	interval := time.Second / time.Duration(cfg.PublishRatePerChannel)

	// city:traffic_lights
	wg.Add(1)
	go func() {
		defer wg.Done()
		publish(ctx, client, "city:traffic_lights", interval, func() any {
			return generators.GenerateTrafficLight()
		})
	}()

	// city:density
	wg.Add(1)
	go func() {
		defer wg.Done()
		publish(ctx, client, "city:density", interval, func() any {
			return generators.GenerateDensity()
		})
	}()

	// city:speed_violations
	wg.Add(1)
	go func() {
		defer wg.Done()
		publish(ctx, client, "city:speed_violations", interval, func() any {
			return generators.GenerateSpeedViolation()
		})
	}()

	log.Println("Fake data servisi başlatıldı. Durdurmak için Ctrl+C")

	<-sigCh
	log.Println("Kapatma sinyali alındı, servis durduruluyor...")
	cancel()
	wg.Wait()
	log.Println("Servis durduruldu.")
}

func publish(ctx context.Context, client *redis.Client, channel string, interval time.Duration, generate func() any) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	var count uint64
	logTicker := time.NewTicker(5 * time.Second)
	defer logTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-logTicker.C:
			log.Printf("[%s] son 5 saniyede %d mesaj gönderildi", channel, count)
			count = 0
		case <-ticker.C:
			data := generate()
			jsonBytes, err := json.Marshal(data)
			if err != nil {
				log.Printf("[%s] JSON marshal hatası: %v", channel, err)
				continue
			}
			if err := client.Publish(ctx, channel, jsonBytes).Err(); err != nil {
				log.Printf("[%s] Publish hatası: %v", channel, err)
				continue
			}
			count++
		}
	}
}

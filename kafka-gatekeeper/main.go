package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"kafka-gatekeeper/config"
	"kafka-gatekeeper/internal/processor"
	redisclient "kafka-gatekeeper/internal/redis"
)

func main() {
	cfg := config.LoadConfig()

	client, err := redisclient.NewClient(cfg)
	if err != nil {
		log.Fatalf("Redis bağlantısı kurulamadı: %v", err)
	}
	defer client.Close()
	log.Printf("Redis bağlantısı başarılı: %s", cfg.RedisURL)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	msgCh := make(chan redisclient.Message, 1000)

	go redisclient.Subscribe(ctx, client, msgCh)


	

	log.Println("Kafka Gatekeeper başlatıldı. Durdurmak için Ctrl+C")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Kapatma sinyali alındı...")
	cancel()
	log.Println("Servis durduruldu.")
}

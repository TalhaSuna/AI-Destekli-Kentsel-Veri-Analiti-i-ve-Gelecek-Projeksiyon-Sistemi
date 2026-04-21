package processor

import (
	"context"
	"log"
	"time"

	"kafka-gatekeeper/config"
	"kafka-gatekeeper/internal/kafka"
	redisclient "kafka-gatekeeper/internal/redis"
)

type Batch struct {
	Topic    string
	Messages []string
}

var channelToTopic map[string]string

func buildTopicMap(cfg *config.AppConfig) {
	channelToTopic = map[string]string{
		"city:traffic_lights":   cfg.KafkaTopicTraffic,
		"city:density":          cfg.KafkaTopicDensity,
		"city:speed_violations": cfg.KafkaTopicSpeed,
	}
}

func StartBatching(ctx context.Context, cfg *config.AppConfig, msgCh <-chan redisclient.Message, producer *kafka.Producer) {
	buildTopicMap(cfg)

	// Her topic için ayrı buffer
	buffers := make(map[string][]string)
	for _, topic := range channelToTopic {
		buffers[topic] = make([]string, 0, cfg.BatchSize)
	}

	timeout := time.Duration(cfg.BatchTimeoutMS) * time.Millisecond
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			// Kalan mesajları flush et
			for topic, msgs := range buffers {
				if len(msgs) > 0 {
					flush(ctx, producer, topic, msgs)
				}
			}
			log.Println("Batcher durduruluyor...")
			return

		case msg, ok := <-msgCh:
			if !ok {
				return
			}
			topic, exists := channelToTopic[msg.Channel]
			if !exists {
				log.Printf("Bilinmeyen kanal: %s", msg.Channel)
				continue
			}
			buffers[topic] = append(buffers[topic], msg.Payload)

			// BatchSize'a ulaştıysa flush et
			if len(buffers[topic]) >= cfg.BatchSize {
				flush(ctx, producer, topic, buffers[topic])
				buffers[topic] = make([]string, 0, cfg.BatchSize)
				timer.Reset(timeout)
			}

		case <-timer.C:
			// Timeout doldu, ne varsa flush et
			for topic, msgs := range buffers {
				if len(msgs) > 0 {
					flush(ctx, producer, topic, msgs)
					buffers[topic] = make([]string, 0, cfg.BatchSize)
				}
			}
			timer.Reset(timeout)
		}
	}
}

func flush(ctx context.Context, producer *kafka.Producer, topic string, messages []string) {
	log.Printf("[BATCH] %s → %d mesaj flush ediliyor", topic, len(messages))
	if err := producer.SendBatch(ctx, topic, messages); err != nil {
		log.Printf("[BATCH] %s → flush hatası: %v", topic, err)
	}
}

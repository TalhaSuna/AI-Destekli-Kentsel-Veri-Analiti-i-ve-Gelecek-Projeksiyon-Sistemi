package processor

import (
	"context"
	"log"
	"time"

	"kafka-gatekeeper/config"
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

func StartBatching(ctx context.Context, cfg *config.AppConfig, msgCh <-chan redisclient.Message) {
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
					flush(topic, msgs)
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
				flush(topic, buffers[topic])
				buffers[topic] = make([]string, 0, cfg.BatchSize)
				timer.Reset(timeout)
			}

		case <-timer.C:
			// Timeout doldu, ne varsa flush et
			for topic, msgs := range buffers {
				if len(msgs) > 0 {
					flush(topic, msgs)
					buffers[topic] = make([]string, 0, cfg.BatchSize)
				}
			}
			timer.Reset(timeout)
		}
	}
}

func flush(topic string, messages []string) {
	log.Printf("[BATCH] %s → %d mesaj flush edilecek (Kafka'ya gönderilecek)", topic, len(messages))
	// TODO: Burada kafka producer çağrılacak
}

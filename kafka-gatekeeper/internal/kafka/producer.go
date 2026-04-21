package kafka

import (
	"context"
	"log"
	"time"

	"kafka-gatekeeper/config"

	kafkago "github.com/segmentio/kafka-go"
)

type Producer struct {
	writers map[string]*kafkago.Writer
}

func NewProducer(cfg *config.AppConfig) *Producer {
	topics := []string{
		cfg.KafkaTopicTraffic,
		cfg.KafkaTopicDensity,
		cfg.KafkaTopicSpeed,
	}

	writers := make(map[string]*kafkago.Writer)
	for _, topic := range topics {
		writers[topic] = &kafkago.Writer{
			Addr:                   kafkago.TCP(cfg.KafkaBroker),
			Topic:                  topic,
			Balancer:               &kafkago.LeastBytes{},
			BatchSize:              cfg.BatchSize,
			BatchTimeout:           time.Duration(cfg.BatchTimeoutMS) * time.Millisecond,
			Async:                  false,
			AllowAutoTopicCreation: true,
		}
	}

	log.Printf("Kafka producer oluşturuldu: broker=%s, topic'ler=%v", cfg.KafkaBroker, topics)
	return &Producer{writers: writers}
}

func (p *Producer) SendBatch(ctx context.Context, topic string, messages []string) error {
	writer, exists := p.writers[topic]
	if !exists {
		log.Printf("Bilinmeyen topic: %s", topic)
		return nil
	}

	kafkaMessages := make([]kafkago.Message, len(messages))
	for i, msg := range messages {
		kafkaMessages[i] = kafkago.Message{
			Value: []byte(msg),
		}
	}

	err := writer.WriteMessages(ctx, kafkaMessages...)
	if err != nil {
		log.Printf("[KAFKA] %s → %d mesaj gönderilemedi: %v", topic, len(messages), err)
		return err
	}

	log.Printf("[KAFKA] %s → %d mesaj başarıyla gönderildi", topic, len(messages))
	return nil
}

func (p *Producer) Close() {
	for topic, writer := range p.writers {
		if err := writer.Close(); err != nil {
			log.Printf("[KAFKA] %s writer kapatılamadı: %v", topic, err)
		}
	}
	log.Println("Kafka producer kapatıldı")
}

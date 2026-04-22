package mqtt

import (
	"fmt"
	"log"

	"dashboard-api/config"

	pahomqtt "github.com/eclipse/paho.mqtt.golang"
)

// Publisher EMQX broker'a MQTT mesajları gönderir.
// Her 1 sn'de ClickHouse'dan alınan yeni verileri
// ilgili topic'e publish eder.
// Frontend bu topic'lere subscribe olarak canlı veri alır.
type Publisher struct {
	client      pahomqtt.Client
	topicPrefix string
}

// NewPublisher EMQX'e bağlanan bir MQTT client oluşturur.
func NewPublisher(cfg *config.AppConfig) (*Publisher, error) {
	opts := pahomqtt.NewClientOptions().
		AddBroker(cfg.MQTTBroker).
		SetClientID(cfg.MQTTClientID).
		SetAutoReconnect(true). // Bağlantı koparsa otomatik tekrar bağlan
		SetOnConnectHandler(func(c pahomqtt.Client) {
			log.Printf("EMQX broker'a bağlandı: %s", cfg.MQTTBroker)
		}).
		SetConnectionLostHandler(func(c pahomqtt.Client, err error) {
			log.Printf("EMQX bağlantısı koptu: %v", err)
		})

	client := pahomqtt.NewClient(opts)

	// Bağlantıyı kur ve 5 saniye bekle
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		return nil, fmt.Errorf("EMQX bağlantısı başarısız: %w", token.Error())
	}

	return &Publisher{
		client:      client,
		topicPrefix: cfg.MQTTTopicPrefix,
	}, nil
}

// Publish belirtilen topic'e JSON verisini gönderir.
// topic: "traffic_lights", "density", "speed_violations"
// data: JSON formatında byte dizisi
// Örnek topic: telemetry/traffic_lights
func (p *Publisher) Publish(topic string, data []byte) error {
	fullTopic := fmt.Sprintf("%s/%s", p.topicPrefix, topic)

	// QoS 0: En fazla 1 kez gönder (fire and forget)
	// Canlı veri için QoS 0 yeterli — bir mesaj kaybolsa sonraki gelir
	token := p.client.Publish(fullTopic, 0, false, data)
	token.Wait()
	if token.Error() != nil {
		return fmt.Errorf("MQTT publish hatası [%s]: %w", fullTopic, token.Error())
	}
	return nil
}

// Close MQTT bağlantısını kapatır.
func (p *Publisher) Close() {
	p.client.Disconnect(1000)
	log.Println("MQTT bağlantısı kapatıldı")
}

package config

import (
	"log"

	"github.com/ilyakaznacheev/cleanenv"
)

// AppConfig tüm servis ayarlarını tek struct'ta toplar.
// cleanenv kütüphanesi .env dosyasından veya ortam değişkenlerinden okur.
type AppConfig struct {
	// ClickHouse bağlantı bilgileri
	ClickHouseAddr string `env:"CLICKHOUSE_ADDR" env-default:"localhost:9000"`
	ClickHouseDB   string `env:"CLICKHOUSE_DATABASE" env-default:"telemetry"`
	ClickHouseUser string `env:"CLICKHOUSE_USER" env-default:"default"`
	ClickHousePass string `env:"CLICKHOUSE_PASSWORD"`

	// EMQX MQTT broker bilgileri
	MQTTBroker      string `env:"MQTT_BROKER" env-default:"tcp://localhost:1883"`
	MQTTClientID    string `env:"MQTT_CLIENT_ID" env-default:"dashboard-api"`
	MQTTTopicPrefix string `env:"MQTT_TOPIC_PREFIX" env-default:"telemetry"`

	// HTTP sunucu portu
	ServerPort string `env:"SERVER_PORT" env-default:"8080"`

	// ClickHouse'a sorgu atma aralığı (milisaniye)
	PollIntervalMS int `env:"POLL_INTERVAL_MS" env-default:"1000"`
}

func LoadConfig() *AppConfig {
	var cfg AppConfig
	err := cleanenv.ReadConfig(".env", &cfg)
	if err != nil {
		log.Println("Bilgi: .env dosyası bulunamadı. Sistem ortam değişkenleri kullanılacak.")
	}
	return &cfg
}

package config

import(
	"log"
	"github.com/ilyakaznacheev/cleanenv"
)

type AppConfig struct {
	RedisURL          string `env:"REDIS_URL" env-default:"localhost:6379"`
	RedisPassword     string `env:"REDIS_PASSWORD"`
	KafkaBroker       string `env:"KAFKA_BROKER" env-default:"localhost:9092"`
	KafkaTopicTraffic string `env:"KAFKA_TOPIC_TRAFFIC" env-default:"telemetry.traffic_lights"`
	KafkaTopicDensity string `env:"KAFKA_TOPIC_DENSITY" env-default:"telemetry.density"`
	KafkaTopicSpeed   string `env:"KAFKA_TOPIC_SPEED" env-default:"telemetry.speed_violations"`
	KafkaTopicAir     string `env:"KAFKA_TOPIC_AIR" env-default:"telemetry.air"`
	
	BatchSize         int    `env:"BATCH_SIZE" env-default:"1000"`
	BatchTimeoutMS    int    `env:"BATCH_TIMEOUT_MS" env-default:"1000"`
}

func LoadConfig() *AppConfig {
	var cfg AppConfig
	err := cleanenv.ReadConfig(".env", &cfg)
	if err != nil {
		log.Println("Bilgi: .env dosyası bulunamadı. Sistem ortam değişkenleri kullanılacak.")
		cleanenv.ReadEnv(&cfg)
	}
	return &cfg
}


package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	RedisHost             string
	RedisPort             string
	RedisPassword         string
	RedisDB               int
	PublishRatePerChannel int
}

func Load() (*Config, error) {
	// .env yoksa (Docker ortamı) sistem env var'larını kullan
	_ = godotenv.Load()

	redisDB, err := strconv.Atoi(getEnv("REDIS_DB", "0"))
	if err != nil {
		redisDB = 0
	}

	rate, err := strconv.Atoi(getEnv("PUBLISH_RATE_PER_CHANNEL", "300"))
	if err != nil {
		rate = 300
	}

	return &Config{
		RedisHost:             getEnv("REDIS_HOST", "localhost"),
		RedisPort:             getEnv("REDIS_PORT", "6379"),
		RedisPassword:         getEnv("REDIS_PASSWORD", ""),
		RedisDB:               redisDB,
		PublishRatePerChannel: rate,
	}, nil
}

func (c *Config) RedisAddr() string {
	return fmt.Sprintf("%s:%s", c.RedisHost, c.RedisPort)
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

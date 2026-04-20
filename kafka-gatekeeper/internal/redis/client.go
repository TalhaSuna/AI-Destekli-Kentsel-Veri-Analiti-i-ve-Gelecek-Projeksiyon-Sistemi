package redis

import (
	"context"
	"fmt"

	"kafka-gatekeeper/config"

	goredis "github.com/redis/go-redis/v9"
)

func NewClient(cfg *config.AppConfig) (*goredis.Client, error) {
	client := goredis.NewClient(&goredis.Options{
		Addr:     cfg.RedisURL,
		Password: cfg.RedisPassword,
	})

	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("redis bağlantısı başarısız: %w", err)
	}

	return client, nil
}

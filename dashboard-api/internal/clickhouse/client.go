package clickhouse

import (
	"context"
	"fmt"
	"log"
	"time"

	"dashboard-api/config"

	ch "github.com/ClickHouse/clickhouse-go/v2"
)

// NewClient ClickHouse'a bağlantı kurar.
// Native protokol (port 9000) üzerinden bağlanır.
func NewClient(cfg *config.AppConfig) (ch.Conn, error) {
	conn, err := ch.Open(&ch.Options{
		Addr: []string{cfg.ClickHouseAddr},
		Auth: ch.Auth{
			Database: cfg.ClickHouseDB,
			Username: cfg.ClickHouseUser,
			Password: cfg.ClickHousePass,
		},
		Settings: ch.Settings{
			"max_execution_time": 60,
		},
		DialTimeout:  5 * time.Second,
		MaxOpenConns: 10,
	})
	if err != nil {
		return nil, fmt.Errorf("clickhouse bağlantısı oluşturulamadı: %w", err)
	}

	// Bağlantıyı test et
	if err := conn.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("clickhouse ping başarısız: %w", err)
	}

	log.Printf("ClickHouse bağlantısı başarılı: %s/%s", cfg.ClickHouseAddr, cfg.ClickHouseDB)
	return conn, nil
}

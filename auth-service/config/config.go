package config

import "os"

type Config struct {
	DBConn  string
	KeysDir string
	Port    string
}

func Load() Config {
	return Config{
		DBConn:  getenv("DATABASE_URL", "postgres://auth:auth_secret@localhost:5433/authdb"),
		KeysDir: getenv("KEYS_DIR", "keys"),
		Port:    getenv("PORT", "8090"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

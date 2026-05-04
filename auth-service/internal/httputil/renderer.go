package httputil

import (
	"context"

	"github.com/aarondl/authboss/v3"
)

// NoopRenderer Authboss'un template renderer ihtiyacını karşılar.
// JSON API'de HTML template kullanmadığımız için boş bırakılır.
type NoopRenderer struct{}

func (NoopRenderer) Load(_ ...string) error { return nil }

func (NoopRenderer) Render(_ context.Context, _ string, _ authboss.HTMLData) ([]byte, string, error) {
	return []byte("{}"), "application/json", nil
}

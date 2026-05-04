package state

import (
	"context"
	"net/http"
	"strings"

	"auth-service/internal/auth"
	"auth-service/internal/roles"
	"auth-service/internal/store"

	"github.com/aarondl/authboss/v3"
)

const TokenHeader = "X-JWT-Token"

// ClientState Authboss'un istekte kullanıcı bilgisini okuduğu yapı.
type ClientState struct {
	pid string
}

func (s ClientState) Get(key string) (string, bool) {
	if key == authboss.SessionKey && s.pid != "" {
		return s.pid, true
	}
	return "", false
}

// RW JWT'yi Authboss'un ClientStateReadWriter arayüzüne adapte eder.
type RW struct {
	keys  *auth.KeyPair
	store *store.Store
}

func New(keys *auth.KeyPair, s *store.Store) *RW {
	return &RW{keys: keys, store: s}
}

// ReadState gelen istekteki Bearer token'ı doğrular ve PID (email) döner.
// Geçersiz/eksik token → anonim kullanıcı, hata fırlatmaz.
func (rw *RW) ReadState(r *http.Request) (authboss.ClientState, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return ClientState{}, nil
	}

	claims, err := rw.keys.VerifyToken(strings.TrimPrefix(header, "Bearer "))
	if err != nil {
		return ClientState{}, nil
	}

	return ClientState{pid: claims.Email}, nil
}

// WriteState başarılı login sonrası Authboss tarafından çağrılır.
// SessionKey event'ini yakalar, RS256 token üretir, response header'a yazar.
func (rw *RW) WriteState(w http.ResponseWriter, _ authboss.ClientState, events []authboss.ClientStateEvent) error {
	for _, ev := range events {
		if ev.Kind != authboss.ClientStateEventPut || ev.Key != authboss.SessionKey {
			continue
		}

		u, err := rw.store.Load(context.Background(), ev.Value)
		if err != nil {
			return err
		}
		usr := u.(*store.User)

		token, err := rw.keys.IssueToken(usr.ID, usr.Email, usr.Role, roles.PermissionsFor(usr.Role))
		if err != nil {
			return err
		}

		w.Header().Set(TokenHeader, token)
	}
	return nil
}

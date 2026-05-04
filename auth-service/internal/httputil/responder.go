package httputil

import (
	"encoding/json"
	"net/http"

	"auth-service/internal/state"

	"github.com/aarondl/authboss/v3"
)

// JSONResponder Authboss hata/bilgi yanıtlarını JSON formatında yazar.
type JSONResponder struct{}

func (JSONResponder) Respond(w http.ResponseWriter, _ *http.Request, code int, _ string, data authboss.HTMLData) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	return json.NewEncoder(w).Encode(data)
}

// JSONRedirector başarılı login sonrası Authboss'un redirect çağrısını yakalar,
// yönlendirme yapmak yerine üretilen JWT'yi JSON olarak döner.
type JSONRedirector struct{}

func (JSONRedirector) Redirect(w http.ResponseWriter, _ *http.Request, ro authboss.RedirectOptions) error {
	w.Header().Set("Content-Type", "application/json")

	if ro.Failure != "" {
		w.WriteHeader(http.StatusUnauthorized)
		return json.NewEncoder(w).Encode(map[string]string{"error": ro.Failure})
	}

	// WriteHeader → Authboss'un putClientState() → WriteState → TokenHeader set edilir.
	// Sadece SONRA header'dan okumak doğru token'ı verir.
	w.WriteHeader(http.StatusOK)
	token := w.Header().Get(state.TokenHeader)
	return json.NewEncoder(w).Encode(map[string]string{"token": token})
}

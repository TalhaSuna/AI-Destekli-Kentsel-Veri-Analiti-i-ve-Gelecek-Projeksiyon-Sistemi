package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

// Servis adresleri — docker network içinde container isimleriyle
const (
	dashboardAPI = "http://dashboard-api:8080"
	authService  = "http://auth-service:8090"
	aiService    = "http://ai-service:8000"
	emqx         = "http://emqx:8083"
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/", route)

	log.Println("Gateway başlatıldı: :9000")
	if err := http.ListenAndServe(":9000", mux); err != nil {
		log.Fatalf("Gateway hatası: %v", err)
	}
}

// route gelen isteğin path'ine bakarak doğru servise yönlendirir.
func route(w http.ResponseWriter, r *http.Request) {
	var target string

	switch {
	case strings.HasPrefix(r.URL.Path, "/api/predictions/"):
		target = aiService
	case strings.HasPrefix(r.URL.Path, "/api/"):
		target = dashboardAPI
	case strings.HasPrefix(r.URL.Path, "/auth/"):
		target = authService
	case strings.HasPrefix(r.URL.Path, "/mqtt"):
		target = emqx
	default:
		http.NotFound(w, r)
		return
	}

	proxy(target, w, r)
}

// proxy isteği hedef servise iletir ve cevabı olduğu gibi döner.
func proxy(target string, w http.ResponseWriter, r *http.Request) {
	targetURL, err := url.Parse(target)
	if err != nil {
		log.Printf("URL parse hatası: %v", err)
		http.Error(w, "Sunucu hatası", http.StatusInternalServerError)
		return
	}

	rp := httputil.NewSingleHostReverseProxy(targetURL)
	rp.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("[Gateway] %s → %s hata: %v", r.URL.Path, target, err)
		http.Error(w, "Servis ulaşılamıyor", http.StatusBadGateway)
	}

	log.Printf("[Gateway] %s → %s", r.URL.Path, target)
	rp.ServeHTTP(w, r)
}

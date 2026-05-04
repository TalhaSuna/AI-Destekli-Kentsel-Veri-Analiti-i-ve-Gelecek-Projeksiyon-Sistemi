package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"auth-service/config"
	"auth-service/internal/auth"
	"auth-service/internal/httputil"
	"auth-service/internal/state"
	"auth-service/internal/store"

	"github.com/aarondl/authboss/v3"
	_ "github.com/aarondl/authboss/v3/auth"
	_ "github.com/aarondl/authboss/v3/logout"
	"github.com/aarondl/authboss/v3/defaults"
)

func main() {
	cfg := config.Load()

	// 1. RSA key pair yükle
	keys, err := auth.LoadKeyPair(cfg.KeysDir)
	if err != nil {
		log.Fatalf("key pair yüklenemedi: %v", err)
	}
	log.Println("RSA key pair yüklendi")

	// 2. PostgreSQL bağlan, tablo + seed
	ctx := context.Background()
	userStore, err := store.New(ctx, cfg.DBConn)
	if err != nil {
		log.Fatalf("store başlatılamadı: %v", err)
	}
	defer userStore.Close()
	log.Println("PostgreSQL bağlantısı kuruldu")

	// 3. Authboss yapılandır
	jwtState := state.New(keys, userStore)
	ab := authboss.New()

	ab.Config.Paths.Mount = "/auth"
	ab.Config.Paths.RootURL = "http://localhost:" + cfg.Port
	ab.Config.Paths.AuthLoginOK = "/auth/ok" // redirect sonrası JSONRedirector yakalar

	ab.Config.Storage.Server = userStore
	ab.Config.Storage.SessionState = jwtState
	ab.Config.Storage.CookieState = jwtState

	router := defaults.NewRouter()
	logger := defaults.NewLogger(os.Stdout)

	ab.Config.Core.Router = router
	ab.Config.Core.Logger = logger
	ab.Config.Core.ErrorHandler = defaults.NewErrorHandler(logger)
	ab.Config.Core.Hasher = authboss.NewBCryptHasher(0)
	ab.Config.Core.BodyReader = httputil.JSONBodyReader{}
	ab.Config.Core.Responder = httputil.JSONResponder{}
	ab.Config.Core.Redirector = httputil.JSONRedirector{}
	ab.Config.Core.ViewRenderer = httputil.NoopRenderer{}
	ab.Config.Core.MailRenderer = httputil.NoopRenderer{}

	if err := ab.Init(); err != nil {
		log.Fatalf("authboss başlatılamadı: %v", err)
	}

	// 4. HTTP routing
	mux := http.NewServeMux()
	mux.Handle("/auth/", ab.LoadClientStateMiddleware(http.StripPrefix("/auth", router)))

	// 5. HTTP sunucu + graceful shutdown
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: corsMiddleware(mux)}
	log.Printf("auth-service başlatıldı: http://localhost:%s", cfg.Port)

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP sunucu hatası: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	log.Println("auth-service durduruluyor...")
	srv.Shutdown(context.Background())
}

// corsMiddleware tüm response'lara CORS header'ları ekler,
// preflight OPTIONS isteklerini 204 ile yanıtlar.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

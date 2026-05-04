package middleware

import (
	"crypto/rsa"
	"net/http"
)

// RequirePermission belirtilen yetkiye sahip olmayan kullanıcıları 403 ile reddeder.
// JWT middleware'inden sonra zincire eklenir.
func RequirePermission(perm string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims := ClaimsFrom(r.Context())
		if claims == nil {
			writeError(w, http.StatusUnauthorized, "kimlik doğrulanmadı")
			return
		}
		for _, p := range claims.Permissions {
			if p == perm {
				next(w, r)
				return
			}
		}
		writeError(w, http.StatusForbidden, "bu işlem için yetkiniz yok: "+perm)
	}
}

// Protect JWT doğrulama + permission kontrolünü tek çağrıda birleştirir.
func Protect(pub *rsa.PublicKey, perm string, handler http.HandlerFunc) http.HandlerFunc {
	return JWT(pub, RequirePermission(perm, handler))
}

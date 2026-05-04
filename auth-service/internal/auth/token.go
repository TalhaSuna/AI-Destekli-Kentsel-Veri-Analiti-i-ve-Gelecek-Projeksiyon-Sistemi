package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	issuer    = "kentsel-auth-service"
	tokenTTL  = 24 * time.Hour
)

// IssueToken kullanıcı bilgilerini RS256 ile imzalanmış JWT'ye dönüştürür.
func (kp *KeyPair) IssueToken(userID, email, role string, permissions []string) (string, error) {
	now := time.Now()

	claims := Claims{
		UserID:      userID,
		Email:       email,
		Role:        role,
		Permissions: permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(kp.Private)
	if err != nil {
		return "", fmt.Errorf("token imzalanamadı: %w", err)
	}
	return signed, nil
}

// VerifyToken token'ı public key ile doğrular ve claims'i döner.
func (kp *KeyPair) VerifyToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("beklenmeyen imzalama metodu: %v", t.Header["alg"])
		}
		return kp.Public, nil
	})
	if err != nil {
		return nil, fmt.Errorf("token geçersiz: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("token claims okunamadı")
	}
	return claims, nil
}

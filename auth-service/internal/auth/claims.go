package auth

import "github.com/golang-jwt/jwt/v5"

// Claims token içindeki kullanıcı bilgilerini taşır.
type Claims struct {
	UserID      string   `json:"sub"`
	Email       string   `json:"email"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

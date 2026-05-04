package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
)

// KeyPair private ve public RSA anahtarlarını tutar.
type KeyPair struct {
	Private *rsa.PrivateKey
	Public  *rsa.PublicKey
}

// LoadKeyPair verilen dizindeki private.pem ve public.pem dosyalarını yükler.
func LoadKeyPair(keysDir string) (*KeyPair, error) {
	priv, err := loadPrivateKey(keysDir + "/private.pem")
	if err != nil {
		return nil, fmt.Errorf("private key yüklenemedi: %w", err)
	}

	pub, err := loadPublicKey(keysDir + "/public.pem")
	if err != nil {
		return nil, fmt.Errorf("public key yüklenemedi: %w", err)
	}

	return &KeyPair{Private: priv, Public: pub}, nil
}

func loadPrivateKey(path string) (*rsa.PrivateKey, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("%s geçerli bir PEM dosyası değil", path)
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	rsakey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("PEM dosyası RSA private key değil")
	}
	return rsakey, nil
}

func loadPublicKey(path string) (*rsa.PublicKey, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("%s geçerli bir PEM dosyası değil", path)
	}

	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	rsakey, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("PEM dosyası RSA public key değil")
	}
	return rsakey, nil
}

// Tek seferlik çalıştırılan RSA 2048-bit key pair üreteci.
// Çıktı: keys/private.pem (0600) ve keys/public.pem (0644)
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"log"
	"os"
)

func main() {
	const keySize = 2048
	const outDir = "keys"

	if err := os.MkdirAll(outDir, 0700); err != nil {
		log.Fatalf("keys/ dizini oluşturulamadı: %v", err)
	}

	log.Printf("RSA %d-bit key pair üretiliyor...", keySize)

	priv, err := rsa.GenerateKey(rand.Reader, keySize)
	if err != nil {
		log.Fatalf("RSA key üretilemedi: %v", err)
	}

	// private.pem — PKCS#8 formatı, sadece owner okuyabilir
	privBytes, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		log.Fatalf("private key marshal hatası: %v", err)
	}
	if err := writePEM(outDir+"/private.pem", "PRIVATE KEY", privBytes, 0600); err != nil {
		log.Fatalf("private.pem yazılamadı: %v", err)
	}
	log.Println("✓ keys/private.pem (mod: 0600)")

	// public.pem — PKIX formatı, diğer servislerle paylaşılır
	pubBytes, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		log.Fatalf("public key marshal hatası: %v", err)
	}
	if err := writePEM(outDir+"/public.pem", "PUBLIC KEY", pubBytes, 0644); err != nil {
		log.Fatalf("public.pem yazılamadı: %v", err)
	}
	log.Println("✓ keys/public.pem (mod: 0644)")

	log.Println("Key pair hazır. private.pem'i asla commit etme!")
}

func writePEM(path, pemType string, der []byte, perm os.FileMode) error {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, perm)
	if err != nil {
		return err
	}
	defer f.Close()
	return pem.Encode(f, &pem.Block{Type: pemType, Bytes: der})
}

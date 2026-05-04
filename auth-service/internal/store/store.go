package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/aarondl/authboss/v3"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// Store Authboss'un ServerStorer arayüzünü PostgreSQL üzerinden karşılar.
type Store struct {
	db *pgxpool.Pool
}

// New PostgreSQL bağlantısını kurar, tabloyu oluşturur ve seed data ekler.
func New(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres bağlantısı kurulamadı: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("postgres ping hatası: %w", err)
	}

	s := &Store{db: pool}
	if err := s.migrate(ctx); err != nil {
		return nil, err
	}
	if err := s.seed(ctx); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() { s.db.Close() }

// migrate users tablosunu oluşturur, zaten varsa dokunmaz.
func (s *Store) migrate(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS users (
			id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email    VARCHAR(255) UNIQUE NOT NULL,
			password VARCHAR(255) NOT NULL,
			role     VARCHAR(50)  NOT NULL DEFAULT 'user'
		)
	`)
	return err
}

// seed admin ve user hesaplarını yoksa ekler.
func (s *Store) seed(ctx context.Context) error {
	accounts := []struct {
		email    string
		password string
		role     string
	}{
		{"admin@kentsel.io", "admin123", "admin"},
		{"user@kentsel.io", "user123", "user"},
	}

	for _, a := range accounts {
		var exists bool
		err := s.db.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)`, a.email,
		).Scan(&exists)
		if err != nil {
			return fmt.Errorf("seed kontrol hatası: %w", err)
		}
		if exists {
			continue
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(a.password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		_, err = s.db.Exec(ctx,
			`INSERT INTO users (email, password, role) VALUES ($1, $2, $3)`,
			a.email, string(hash), a.role,
		)
		if err != nil {
			return fmt.Errorf("seed insert hatası: %w", err)
		}
	}
	return nil
}

// Load Authboss'un kullanıcıyı email ile aradığı metot.
func (s *Store) Load(ctx context.Context, key string) (authboss.User, error) {
	u := &User{}
	err := s.db.QueryRow(ctx,
		`SELECT id, email, password, role FROM users WHERE email=$1`, key,
	).Scan(&u.ID, &u.Email, &u.Password, &u.Role)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, authboss.ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// Save Authboss'un kullanıcı güncellemesi için çağırdığı metot.
func (s *Store) Save(ctx context.Context, user authboss.User) error {
	u := user.(*User)
	_, err := s.db.Exec(ctx,
		`UPDATE users SET password=$1 WHERE email=$2`,
		u.Password, u.Email,
	)
	return err
}

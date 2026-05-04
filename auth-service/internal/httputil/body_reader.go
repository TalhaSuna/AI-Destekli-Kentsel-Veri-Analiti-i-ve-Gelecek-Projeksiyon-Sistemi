package httputil

import (
	"encoding/json"
	"net/http"

	"github.com/aarondl/authboss/v3"
)

// loginValues POST /auth/login JSON gövdesini taşır.
// Authboss'un UserValuer arayüzünü karşılar: GetPID + GetPassword + Validate.
type loginValues struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (v loginValues) GetPID() string      { return v.Email }
func (v loginValues) GetPassword() string { return v.Password }
func (v loginValues) Validate() []error   { return nil }

// JSONBodyReader Authboss'un BodyReader arayüzünü JSON için implemente eder.
type JSONBodyReader struct{}

func (JSONBodyReader) Read(_ string, r *http.Request) (authboss.Validator, error) {
	var v loginValues
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		return nil, err
	}
	return v, nil
}

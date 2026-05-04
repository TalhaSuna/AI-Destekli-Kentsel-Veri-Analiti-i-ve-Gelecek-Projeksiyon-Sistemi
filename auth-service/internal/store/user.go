package store

// User veritabanındaki kullanıcı kaydını temsil eder.
// Authboss'un User arayüzünü karşılar: GetPID/PutPID, GetPassword/PutPassword.
type User struct {
	ID       string
	Email    string
	Password string // bcrypt hash
	Role     string
}

func (u *User) GetPID() string        { return u.Email }
func (u *User) PutPID(pid string)     { u.Email = pid }
func (u *User) GetPassword() string   { return u.Password }
func (u *User) PutPassword(p string)  { u.Password = p }

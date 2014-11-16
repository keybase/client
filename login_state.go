package libkb

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"github.com/keybase/go-triplesec"
)

type LoggedInResult struct {
	sessionId string
	csrfToken string
	uid       UID
	username  string
}

type LoginState struct {
	Configured      bool
	LoggedIn        bool
	SessionVerified bool

	salt              []byte
	login_session     []byte
	login_session_b64 string
	tsec              *triplesec.Cipher
	sharedSecret      []byte

	loggedInRes *LoggedInResult
}

const SharedSecretLen = 32

func NewLoginState() *LoginState {
	return &LoginState{}
}

func (s LoginState) IsLoggedIn() bool {
	return s.LoggedIn
}

func (s *LoginState) GetSalt() (salt []byte, err error) {
	if s.salt == nil {
		s.salt = G.Env.GetSalt()
	}
	salt = s.salt
	return
}

func (s *LoginState) GetSaltAndLoginSession(email_or_username string) error {

	if s.salt != nil && s.login_session != nil {
		return nil
	}

	res, err := G.API.Get(ApiArg{
		Endpoint:    "getsalt",
		NeedSession: false,
		Args: HttpArgs{
			"email_or_username": S{email_or_username},
		},
	})
	if err != nil {
		return err
	}

	shex, err := res.Body.AtKey("salt").GetString()
	if err != nil {
		return err
	}

	s.salt, err = hex.DecodeString(shex)
	if err != nil {
		return err
	}

	ls_b64, err := res.Body.AtKey("login_session").GetString()
	if err != nil {
		return err
	}

	s.login_session, err = base64.StdEncoding.DecodeString(ls_b64)
	if err != nil {
		return err
	}

	s.login_session_b64 = ls_b64

	return nil
}

func (s *LoginState) StretchKey(passphrase string) (err error) {
	if s.tsec == nil {
		if s.tsec, err = triplesec.NewCipher([]byte(passphrase), s.salt); err != nil {
			return
		}
	}
	_, s.sharedSecret, err = s.tsec.DeriveKey(SharedSecretLen)
	return
}

func (s *LoginState) ComputeLoginPw() ([]byte, error) {
	mac := hmac.New(sha512.New, s.sharedSecret)
	mac.Write(s.login_session)
	return mac.Sum(nil), nil
}

func (s *LoginState) PostLoginToServer(eOu string, lgpw []byte) error {
	res, err := G.API.Post(ApiArg{
		Endpoint:    "login",
		NeedSession: false,
		Args: HttpArgs{
			"email_or_username": S{eOu},
			"hmac_pwh":          S{hex.EncodeToString(lgpw)},
			"login_session":     S{s.login_session_b64},
		},
		AppStatus: []string{"OK", "BAD_LOGIN_PASSWORD"},
	})
	if err != nil {
		return err
	}
	if res.AppStatus == "BAD_LOGIN_PASSWORD" {
		err = PassphraseError{"server rejected login attempt"}
		return err
	}

	b := res.Body
	sessionId, err := b.AtKey("session").GetString()
	if err != nil {
		return err
	}
	csrfToken, err := b.AtKey("csrf_token").GetString()
	if err != nil {
		return err
	}
	uid, err := GetUid(b.AtKey("uid"))
	if err != nil {
		return nil
	}
	uname, err := b.AtKey("me").AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil
	}

	s.loggedInRes = &LoggedInResult{sessionId, csrfToken, *uid, uname}
	return nil
}

func (s *LoginState) SaveLoginState(prompted bool) error {
	s.LoggedIn = true
	s.SessionVerified = true

	if cfg := G.Env.GetConfigWriter(); cfg != nil {
		if prompted {
			cfg.SetUsername(s.loggedInRes.username)
		}
		cfg.SetUid(s.loggedInRes.uid)
		cfg.SetSalt(s.salt)

		if err := cfg.Write(); err != nil {
			return err
		}
	}

	if sw := G.SessionWriter; sw != nil {
		sw.SetLoggedIn(*s.loggedInRes)
		if err := sw.Write(); err != nil {
			return err
		}
	}

	return nil
}

func (s *LoginState) Logout() error {
	G.Log.Debug("+ Logout called")
	err := G.Session.Logout()
	if err == nil {
		s.LoggedIn = false
		s.SessionVerified = false
	}
	G.Log.Debug("- Logout called")
	return err
}

type LoginArg struct {
	Force    bool
	Prompt   bool
	Retry    int
	RetryMsg string
}

func (s *LoginState) Login(arg LoginArg) error {
	G.Log.Debug("+ Login called")

	n_tries := arg.Retry
	if n_tries == 0 {
		n_tries = 1
	}
	var err error

	for i := 0; i < n_tries; i++ {
		err = s.login(arg)
		if err == nil {
			break
		} else if _, badpw := err.(PassphraseError); !badpw {
			break
		} else {
			arg.RetryMsg = err.Error()
		}
	}
	return err
}

func (s *LoginState) login(arg LoginArg) error {

	if s.LoggedIn && !arg.Force {
		G.Log.Debug("- Login short-circuited; already logged in")
		return nil
	}

	if !arg.Force {
		is_valid, err := G.Session.LoadAndCheck()
		if err != nil {
			return err
		}

		if is_valid {
			s.LoggedIn = true
			s.SessionVerified = true
			G.Log.Debug("Our session token is still valid; we're logged in")
			return nil
		}
	} else if err := G.Session.Load(); err != nil {
		return err
	}

	email_or_username, prompted, err := G.Env.GetOrPromptForEmailOrUsername(arg.Prompt)
	if err != nil {
		return err
	}
	if len(email_or_username) == 0 {
		err = fmt.Errorf("Username or login not known")
		return err
	}

	G.Log.Debug(fmt.Sprintf("| got username: %s\n", email_or_username))

	if err = s.GetSaltAndLoginSession(email_or_username); err != nil {
		return err
	}

	if _, err = s.GetTriplesec(arg.RetryMsg); err != nil {
		return err
	}

	lgpw, err := s.ComputeLoginPw()

	if err != nil {
		return err
	}

	err = s.PostLoginToServer(email_or_username, lgpw)
	if err != nil {
		s.tsec = nil
		return err
	}

	err = s.SaveLoginState(prompted)
	if err != nil {
		return err
	}

	G.Log.Debug("- Login completed")
	return nil
}

func (s *LoginState) GetTriplesec(retry string) (ret *triplesec.Cipher, err error) {
	if s.tsec != nil {
		ret = s.tsec
		return
	}
	var salt []byte
	if salt, err = s.GetSalt(); err != nil {
		return
	} else if salt == nil {
		err = fmt.Errorf("Cannot encrypt; no salt found")
	}

	var pw string
	if pw, err = PromptForKeybasePassphrase(retry); err != nil {
		return
	}

	if err = s.StretchKey(pw); err != nil {
		return
	}

	ret = s.tsec

	return
}

func (s *LoginState) GetCachedTriplesec() *triplesec.Cipher {
	return s.tsec
}

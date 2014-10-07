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
	uid       string
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

	logged_in_res *LoggedInResult
}

const SharedSecretLen = 32

func NewLoginState() *LoginState {
	return &LoginState{false, false, false, nil, nil, "", nil, nil}
}

func (s *LoginState) GetSalt(email_or_username string) error {
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

func (s *LoginState) StretchKey(passphrase string) ([]byte, error) {
	if s.tsec == nil {
		var err error
		s.tsec, err = triplesec.NewCipher([]byte(passphrase), s.salt)
		if err != nil {
			return nil, err
		}
	}
	_, shared_secret, err := s.tsec.DeriveKey(SharedSecretLen)
	return shared_secret, err
}

func (s *LoginState) ComputeLoginPw(shared_secret []byte) ([]byte, error) {
	mac := hmac.New(sha512.New, shared_secret)
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
	})
	if err != nil {
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
	uid, err := b.AtKey("uid").GetString()
	if err != nil {
		return nil
	}
	uname, err := b.AtKey("me").AtKey("basics").AtKey("username").GetString()
	if err != nil {
		return nil
	}

	s.logged_in_res = &LoggedInResult{sessionId, csrfToken, uid, uname}
	return nil
}

func (s *LoginState) SaveLoginState(prompted bool) error {
	s.LoggedIn = true
	s.SessionVerified = true

	if cfg := G.Env.GetConfigWriter(); cfg != nil {
		if prompted {
			cfg.SetUsername(s.logged_in_res.username)
		}
		cfg.SetUid(s.logged_in_res.uid)
		cfg.SetSalt(hex.EncodeToString(s.salt))
	}

	return nil
}

func (s *LoginState) Login() error {
	G.Log.Debug("+ Login called")

	if s.LoggedIn {
		G.Log.Debug("- Login short-circuited; already logged in")
		return nil
	}

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

	email_or_username, prompted, err := G.Env.GetOrPromptForEmailOrUsername()
	if err != nil {
		return err
	}

	err = s.GetSalt(email_or_username)
	if err != nil {
		return err
	}

	G.Log.Debug(fmt.Sprintf("| got username: %s\n", email_or_username))

	pw, err := Prompt("keybase password", true, CheckPasswordSimple)

	if err != nil {
		return err
	}

	shared_secret, err := s.StretchKey(pw)
	if err != nil {
		return err
	}

	lgpw, err := s.ComputeLoginPw(shared_secret)

	if err != nil {
		return err
	}

	err = s.PostLoginToServer(email_or_username, lgpw)
	if err != nil {
		return err
	}

	err = s.SaveLoginState(prompted)
	if err != nil {
		return err
	}

	G.Log.Debug("- Login completed")
	return nil
}

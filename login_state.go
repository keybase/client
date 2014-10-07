package libkb

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
)

type LoginState struct {
	Configured      bool
	LoggedIn        bool
	SessionVerified bool

	salt          []byte
	login_session []byte
}

func NewLoginState() *LoginState {
	return &LoginState{false, false, false, nil, nil}
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

	lb64, err := res.Body.AtKey("login_session").GetString()
	if err != nil {
		return err
	}

	s.login_session, err = base64.StdEncoding.DecodeString(lb64)
	if err != nil {
		return err
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
		G.Log.Debug("Our session token is still valid; we're logged in")
		return nil
	}

	email_or_username, err := G.Env.GetOrPromptForEmailOrUsername()
	if err != nil {
		return err
	}

	G.Log.Debug(fmt.Sprintf("| got username: %s\n", email_or_username))

	pw, err := Prompt("keybase password", true, CheckPasswordSimple)

	if err != nil {
		return err
	}

	err = s.GetSalt(email_or_username)
	if err != nil {
		return err
	}

	fmt.Printf("go pw: %s %v %v\n", pw, s.salt, s.login_session)

	G.Log.Debug("- Login completed")
	return nil
}

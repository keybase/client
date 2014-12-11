package libkb

import (
	"fmt"
)

type SignupEngine struct {
	loginState *LoginState
	salt       []byte
	pwh        []byte

	uid     UID
	session string
	csrf    string
}

func (s *SignupEngine) CheckRegistered() (err error) {
	if cr := G.Env.GetConfig(); cr != nil {
		err = fmt.Errorf("No configuration file available")
	} else if u := cr.GetUid(); u != nil {
		err = AlreadyRegisteredError{*u}
	}
	return err
}

func (s *SignupEngine) GenPwh(p string) (err error) {
	G.Log.Debug("+ GenPwh")
	state := NewLoginState()
	if err = state.GenerateNewSalt(); err != nil {
	} else if err = state.StretchKey(p); err != nil {
	} else {
		s.pwh = state.GetSharedSecret()
		s.salt, err = state.GetSalt()
		s.loginState = state
	}
	return err
}

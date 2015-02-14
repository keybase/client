package engine

import (
	"github.com/keybase/go/libkb"
)

type LoginEngine struct{}

func NewLoginEngine() *LoginEngine {
	return &LoginEngine{}
}

type LoginEngineArg struct {
	Login    libkb.LoginArg
	LogUI    libkb.LogUI
	DoctorUI libkb.DoctorUI
}

func (e *LoginEngine) Run(arg LoginEngineArg) (err error) {
	if err := G.LoginState.Login(arg.Login); err != nil {
		return err
	}

	if arg.LogUI == nil && G.UI != nil {
		arg.LogUI = G.UI.GetLogUI()
	}

	var u *libkb.User

	// We might need to ID ourselves, to load us in here
	if u, err = libkb.LoadMe(libkb.LoadUserArg{ForceReload: true}); err == nil {
	} else if _, not_found := err.(libkb.NoKeyError); not_found {
		err = nil
	} else {
		return err
	}

	// create a doctor engine to check the account
	doctor := NewDoctor(arg.DoctorUI, arg.Login.SecretUI, arg.LogUI)
	return doctor.LoginCheckup(u)
}

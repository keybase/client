package engine

import (
	"fmt"

	"github.com/keybase/go/libkb"
)

type LoginEngine struct{}

func NewLoginEngine() *LoginEngine {
	return &LoginEngine{}
}

type LoginAndIdentifyArg struct {
	Login      libkb.LoginArg
	IdentifyUI libkb.IdentifyUI
	LogUI      libkb.LogUI
}

func (e *LoginEngine) LoginAndIdentify(arg LoginAndIdentifyArg) error {
	if err := G.LoginState.Login(arg.Login); err != nil {
		return err
	}

	identify := arg.IdentifyUI
	log := arg.LogUI

	if log == nil && G.UI != nil {
		log = G.UI.GetLogUI()
	}

	// We might need to ID ourselves, to load us in here
	u, err := libkb.LoadMe(libkb.LoadUserArg{ForceReload: true})
	if _, not_found := err.(libkb.NoKeyError); not_found {
		err = nil
	} else if err != nil {

	} else if u2 := G.Env.GetUid(); u2 != nil && !u2.Eq(u.GetUid()) {
		err = libkb.UidMismatchError{Msg: fmt.Sprintf("Got wrong uid; wanted %s but got %s",
			u.GetUid(), u2)}
	} else if u2 == nil && identify != nil {
		log.Warning("Verifying your UID...")
		err = u.IdentifySelf(identify)
		if err == nil && log != nil {
			log.Warning("Setting UID to %s", u.GetUid())
		}
	}
	return err
}

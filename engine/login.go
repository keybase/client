package engine

import (
	"fmt"

	"github.com/keybase/go/libkb"
)

type LoginEngineArg struct {
	Login  libkb.LoginArg
	KexSrv KexServer
}

type LoginEngine struct{}

func NewLoginEngine() *LoginEngine {
	return &LoginEngine{}
}

func (e *LoginEngine) Name() string {
	return "Login"
}

func (e *LoginEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

func (e *LoginEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{NewDoctor()}
}

func (e *LoginEngine) Run(ctx *Context, args interface{}, reply interface{}) (err error) {
	arg, ok := args.(LoginEngineArg)
	if !ok {
		return fmt.Errorf("LoginEngine.Run: invalid args type %T", args)
	}
	arg.Login.SecretUI = ctx.UIG().Secret
	arg.Login.Ui = ctx.UIG().Login
	if err := G.LoginState.Login(arg.Login); err != nil {
		return err
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
	doctor := NewDoctor(WithKexServer(arg.KexSrv))
	return doctor.LoginCheckup(ctx, u)
}

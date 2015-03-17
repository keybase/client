package engine

import "github.com/keybase/client/go/libkb"

type LoginEngineArg struct {
	Login libkb.LoginArg
}

type LoginEngine struct {
	libkb.Contextified
	arg *LoginEngineArg
}

func NewLoginEngine(arg *LoginEngineArg) *LoginEngine {
	return &LoginEngine{arg: arg}
}

func (e *LoginEngine) Name() string {
	return "Login"
}

func (e *LoginEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (e *LoginEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

func (e *LoginEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{NewDoctor()}
}

func (e *LoginEngine) Run(ctx *Context) (err error) {
	e.SetGlobalContext(ctx.GlobalContext)

	e.arg.Login.SecretUI = ctx.SecretUI
	e.arg.Login.Ui = ctx.LoginUI
	if err := e.G().LoginState.Login(e.arg.Login); err != nil {
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
	doctor := NewDoctor()
	return doctor.LoginCheckup(ctx, u)
}

package engine

import (
	"github.com/keybase/client/go/libkb"
)

type LoginOffline struct {
	libkb.Contextified
}

func NewLoginOffline(g *libkb.GlobalContext) *LoginOffline {
	return &LoginOffline{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *LoginOffline) Name() string {
	return "LoginOffline"
}

// Prereqs returns the engine prereqs.
func (e *LoginOffline) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginOffline) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginOffline) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *LoginOffline) Run(ctx *Context) error {
	if err := e.run(ctx); err != nil {
		return err
	}

	e.G().Log.Debug("LoginOffline success, sending login notification")
	e.G().NotifyRouter.HandleLogin(string(e.G().Env.GetUsername()))
	e.G().Log.Debug("LoginOffline success, calling login hooks")
	e.G().CallLoginHooks()

	return nil
}

func (e *LoginOffline) run(ctx *Context) error {
	var gerr error
	aerr := e.G().LoginState().Account(func(a *libkb.Account) {
		_, err := libkb.BootstrapActiveDeviceFromConfig(NewMetaContext(e, ctx).WithLoginContext(a), false)
		if err != nil {
			gerr = libkb.NewLoginRequiredError(err.Error())
		}
		return
	}, "LoginOffline")

	if aerr != nil {
		e.G().Log.Debug("LoginOffline: LoginState account error: %s", aerr)
		return aerr
	}
	if gerr != nil {
		return gerr
	}

	e.G().Log.Debug("LoginOffline: run success")

	return nil
}

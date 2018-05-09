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

func (e *LoginOffline) Run(m libkb.MetaContext) error {
	if err := e.run(m); err != nil {
		return err
	}

	m.CDebugf("LoginOffline success, sending login notification")
	m.G().NotifyRouter.HandleLogin(string(e.G().Env.GetUsername()))
	m.CDebugf("LoginOffline success, calling login hooks")
	m.G().CallLoginHooks()

	return nil
}

func (e *LoginOffline) run(m libkb.MetaContext) error {
	var gerr error
	aerr := m.G().LoginState().Account(func(a *libkb.Account) {
		m := m.WithLoginContext(a)
		_, err := libkb.BootstrapActiveDeviceFromConfig(m, false)
		if err != nil {
			gerr = libkb.NewLoginRequiredError(err.Error())
		}
		return
	}, "LoginOffline")

	if aerr != nil {
		m.CDebugf("LoginOffline: LoginState account error: %s", aerr)
		return aerr
	}
	if gerr != nil {
		return gerr
	}
	m.CDebugf("LoginOffline: run success")
	return nil
}

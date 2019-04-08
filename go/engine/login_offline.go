package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
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
	uid, err := e.run(m)
	if err != nil {
		return err
	}
	m.Debug("LoginOffline success, sending login notification")
	m.G().NotifyRouter.HandleLogin(m.Ctx(), string(e.G().Env.GetUsernameForUID(uid)))
	m.Debug("LoginOffline success, calling login hooks")
	m.G().CallLoginHooks(m)

	return nil
}

func (e *LoginOffline) run(m libkb.MetaContext) (uid keybase1.UID, err error) {
	defer m.Trace("LoginOffline#run", func() error { return err })()
	uid, err = libkb.BootstrapActiveDeviceFromConfig(m, false)
	if err != nil {
		err = libkb.NewLoginRequiredError(err.Error())
		return uid, err
	}
	return uid, nil
}

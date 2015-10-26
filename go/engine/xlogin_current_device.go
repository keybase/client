package engine

import (
	"github.com/keybase/client/go/libkb"
)

// XLoginCurrentDevice is an engine that tries to login using the
// current device, if there is an existing provisioned device.
type XLoginCurrentDevice struct {
	libkb.Contextified
	username string
}

// NewXLoginCurrentDevice creates a XLoginCurrentDevice engine.
func NewXLoginCurrentDevice(g *libkb.GlobalContext, username string) *XLoginCurrentDevice {
	return &XLoginCurrentDevice{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *XLoginCurrentDevice) Name() string {
	return "XLoginCurrentDevice"
}

// GetPrereqs returns the engine prereqs.
func (e *XLoginCurrentDevice) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *XLoginCurrentDevice) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *XLoginCurrentDevice) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *XLoginCurrentDevice) Run(ctx *Context) error {
	// already logged in?
	in, err := e.G().LoginState().LoggedInProvisionedLoad()
	if err == nil && in {
		return nil
	}

	var config *libkb.UserConfig
	if len(e.username) == 0 {
		config, err = e.G().Env.GetConfig().GetUserConfig()
	} else {
		nu := libkb.NewNormalizedUsername(e.username)
		config, err = e.G().Env.GetConfig().GetUserConfigForUsername(nu)
	}
	if err != nil {
		e.G().Log.Debug("error getting user config: %s (%T)", err, err)
		return errNoConfig
	}
	if config == nil {
		e.G().Log.Debug("user config is nil")
		return errNoConfig
	}
	if config.GetDeviceID().IsNil() {
		e.G().Log.Debug("no device in user config")
		return errNoDevice
	}

	// at this point, there is a user config either for the current user or for e.username
	// and it has a device id, so this should be a provisioned device.  Thus, they should
	// just login normally.

	var afterLogin = func(lctx libkb.LoginContext) error {
		if err := lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID()); err != nil {
			// not a fatal error, session will stay in memory
			e.G().Log.Warning("error saving session file: %s", err)
		}
		return nil
	}
	return e.G().LoginState().LoginWithPrompt(e.username, ctx.LoginUI, ctx.SecretUI, afterLogin)
}

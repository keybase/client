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
func (e *XLoginCurrentDevice) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ XLoginCurrentDevice.Run()")
	defer func() { e.G().Log.Debug("- XLoginCurrentDevice.Run() -> %s", libkb.ErrToOk(err)) }()

	// already logged in?
	in, err := e.G().LoginState().LoggedInProvisionedLoad()
	if err == nil && in {
		return nil
	}

	// have a username?
	if len(e.username) == 0 {
		// try the session:
		var nu *libkb.NormalizedUsername
		err = e.G().LoginState().LocalSession(func(s *libkb.Session) {
			nu = s.GetUsername()
		}, "XLoginCurrentDevice.Run()")
		if err != nil {
			return err
		}
		if nu != nil {
			e.username = nu.String()
		}

		if len(e.username) == 0 {
			// try config:
			e.username = e.G().Env.GetConfig().GetUsername().String()
		}
	}

	if len(e.username) == 0 {
		err = errNoUsername
		return err
	}

	// try pubkey/stored secret login:
	after := func(lctx libkb.LoginContext) error {
		return e.postLogin(ctx, lctx)
	}
	err = e.G().LoginState().LoginWithStoredSecret(e.username, after)

	// XXX if that didn't work because of a stored secret error, the user
	// still could be on a provisioned device, they just didn't store the
	// secret and need to enter a passphrase.
	//
	// check if there is a device id in config file for e.username?

	return err
}

func (e *XLoginCurrentDevice) postLogin(ctx *Context, lctx libkb.LoginContext) error {
	arg := libkb.NewLoadUserForceArg(e.G())
	arg.LoginContext = lctx
	user, err := libkb.LoadMe(arg)
	if err != nil {
		return err
	}

	if !user.HasDeviceInCurrentInstall() {
		return errNoDevice
	}

	// XXX not 100% sure this is necessary...
	if err := lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID()); err != nil {
		// not a fatal error, session will stay in memory
		e.G().Log.Warning("error saving session file: %s", err)
	}

	return nil
}

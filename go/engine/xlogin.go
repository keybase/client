// This is the main login engine.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// XLogin is an engine.
type XLogin struct {
	libkb.Contextified
}

// NewXLogin creates a XLogin engine.
func NewXLogin(g *libkb.GlobalContext) *XLogin {
	return &XLogin{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *XLogin) Name() string {
	return "XLogin"
}

// GetPrereqs returns the engine prereqs.
func (e *XLogin) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *XLogin) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *XLogin) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *XLogin) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ XLogin.Run()")
	defer func() { e.G().Log.Debug("- XLogin.Run() -> %s", libkb.ErrToOk(err)) }()

	// first see if this device is already provisioned and it is possible to log in:
	eng := NewXLoginCurrentDevice(e.G())
	err = RunEngine(eng, ctx)
	if err == nil {
		// login successful
		e.G().Log.Debug("XLoginCurrentDevice.Run() was successful")
		return err
	}

	// if this device has been provisioned already and there was an error, then
	// return that error.  Otherwise, ignore it and keep going.
	if !e.notProvisionedErr(err) {
		return err
	}

	e.G().Log.Debug("XLoginProvisioned error: %s (continuing with device provisioning...)", err)

	// this device needs to be provisioned:
	deng := NewXLoginProvision(e.G())
	err = RunEngine(deng, ctx)

	return err
}

// notProvisionedErr will return true if err signifies that login
// failed because this device has not yet been provisioned.
func (e *XLogin) notProvisionedErr(err error) bool {
	return false
}

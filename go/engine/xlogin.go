// This is the main login engine.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
)

var errNoUsername = errors.New("No username available in session")
var errNoDevice = errors.New("No device provisioned locally for this user")

// XLogin is an engine.
type XLogin struct {
	libkb.Contextified
	deviceType string
	username   string
}

// NewXLogin creates a XLogin engine.  username is optional.
// deviceType should be libkb.DeviceTypeDesktop or
// libkb.DeviceTypeMobile.
func NewXLogin(g *libkb.GlobalContext, deviceType, username string) *XLogin {
	return &XLogin{
		Contextified: libkb.NewContextified(g),
		deviceType:   deviceType,
		username:     username,
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
	return []libkb.UIConsumer{
		&XLoginCurrentDevice{},
		&XLoginProvision{},
	}
}

// Run starts the engine.
func (e *XLogin) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ XLogin.Run()")
	defer func() { e.G().Log.Debug("- XLogin.Run() -> %s", libkb.ErrToOk(err)) }()

	// first see if this device is already provisioned and it is possible to log in:
	eng := NewXLoginCurrentDevice(e.G(), e.username)
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
	deng := NewXLoginProvision(e.G(), e.deviceType)
	err = RunEngine(deng, ctx)

	return err
}

// notProvisionedErr will return true if err signifies that login
// failed because this device has not yet been provisioned.
func (e *XLogin) notProvisionedErr(err error) bool {
	if err == errNoUsername {
		return true
	}
	if err == errNoDevice {
		return true
	}
	switch err.(type) {
	case libkb.SecretStoreError:
		return true
	}

	e.G().Log.Debug("notProvisioned, not handling error %s (err type: %T)", err, err)

	return false
}

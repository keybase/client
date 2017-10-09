// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is the main login engine.

package engine

import (
	"errors"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

var errNoConfig = errors.New("No user config available")
var errNoDevice = errors.New("No device provisioned locally for this user")

// Login is an engine.
type Login struct {
	libkb.Contextified
	deviceType      string
	usernameOrEmail string
	clientType      keybase1.ClientType
}

// NewLogin creates a Login engine.  username is optional.
// deviceType should be libkb.DeviceTypeDesktop or
// libkb.DeviceTypeMobile.
func NewLogin(g *libkb.GlobalContext, deviceType string, usernameOrEmail string, ct keybase1.ClientType) *Login {
	return &Login{
		Contextified:    libkb.NewContextified(g),
		deviceType:      deviceType,
		usernameOrEmail: strings.TrimSpace(usernameOrEmail),
		clientType:      ct,
	}
}

// Name is the unique engine name.
func (e *Login) Name() string {
	return "Login"
}

// GetPrereqs returns the engine prereqs.
func (e *Login) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Login) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Login) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&LoginProvisionedDevice{},
		&loginLoadUser{},
		&loginProvision{},
	}
}

// Run starts the engine.
func (e *Login) Run(ctx *Context) error {
	// check to see if already logged in
	loggedInOK, err := e.checkLoggedIn(ctx)
	if err != nil {
		return err
	}
	if loggedInOK {
		return nil
	}
	e.G().Log.Debug("Login: not currently logged in")

	if len(e.usernameOrEmail) > 0 && libkb.CheckEmail.F(e.usernameOrEmail) {
		// If e.usernameOrEmail is provided and it is an email address, then
		// loginProvisionedDevice is pointless.  It would return an error,
		// but might as well not even use it.
		e.G().Log.Debug("skipping loginProvisionedDevice since %q provided to Login, which looks like an email address.", e.usernameOrEmail)
	} else {
		// First see if this device is already provisioned and it is possible to log in.
		loggedInOK, err := e.loginProvisionedDevice(ctx, e.usernameOrEmail)
		if err != nil {
			e.G().Log.Debug("loginProvisionedDevice error: %s", err)
			return err
		}
		if loggedInOK {
			e.G().Log.Debug("loginProvisionedDevice success")
			return nil
		}

		e.G().Log.Debug("loginProvisionedDevice failed, continuing with device provisioning")
	}

	// clear out any existing session:
	e.G().Log.Debug("clearing any exising login session with Logout before loading user for login")
	e.G().Logout()

	// run the LoginLoadUser sub-engine to load a user
	e.G().Log.Debug("loading login user for %q", e.usernameOrEmail)
	ueng := newLoginLoadUser(e.G(), e.usernameOrEmail)
	if err := RunEngine(ueng, ctx); err != nil {
		return err
	}

	// make sure the user isn't already provisioned (can
	// get here if usernameOrEmail is an email address
	// for an already provisioned on this device user).
	if ueng.User().HasCurrentDeviceInCurrentInstall() {
		e.G().Log.Debug("user %q (%s) has previously provisioned this device, trying to login on it", e.usernameOrEmail, ueng.User().GetName())
		loggedInOK, err := e.loginProvisionedDevice(ctx, ueng.User().GetName())
		if err != nil {
			e.G().Log.Debug("loginProvisionedDevice after loginLoadUser error: %s", err)
			return err
		}
		if loggedInOK {
			e.G().Log.Debug("loginProvisionedDevice after loginLoadUser success")
			return nil
		}

		// this shouldn't happen:
		e.G().Log.Debug("loginProvisionedDevice after loginLoadUser (and user had current deivce in current install), failed to login [unexpected]")
		return libkb.DeviceAlreadyProvisionedError{}
	}

	e.G().Log.Debug("attempting device provisioning")

	darg := &loginProvisionArg{
		DeviceType: e.deviceType,
		ClientType: e.clientType,
		User:       ueng.User(),
	}
	deng := newLoginProvision(e.G(), darg)
	if err := RunEngine(deng, ctx); err != nil {
		return err
	}

	e.perUserKeyUpgradeSoft(ctx)

	e.G().Log.Debug("Login provisioning success, sending login notification")
	e.sendNotification()
	return nil
}

// notProvisionedErr will return true if err signifies that login
// failed because this device has not yet been provisioned.
func (e *Login) notProvisionedErr(err error) bool {
	if err == errNoDevice {
		return true
	}
	if err == errNoConfig {
		return true
	}

	e.G().Log.Debug("notProvisioned, not handling error %s (err type: %T)", err, err)

	return false
}

func (e *Login) sendNotification() {
	e.G().NotifyRouter.HandleLogin(string(e.G().Env.GetUsername()))
	e.G().CallLoginHooks()
}

// Get a per-user key.
// Wait for attempt but only warn on error.
func (e *Login) perUserKeyUpgradeSoft(ctx *Context) error {
	eng := NewPerUserKeyUpgrade(e.G(), &PerUserKeyUpgradeArgs{})
	err := RunEngine(eng, ctx)
	if err != nil {
		e.G().Log.CWarningf(ctx.GetNetContext(), "loginProvision PerUserKeyUpgrade failed: %v", err)
	}
	return err
}

func (e *Login) checkLoggedIn(ctx *Context) (bool, error) {
	if !e.G().ActiveDevice.Valid() {
		return false, nil
	}

	if len(e.usernameOrEmail) == 0 {
		e.G().Log.Debug("Login: already logged in, no username or email provided, so returning without error")
		return true, nil
	}
	if libkb.CheckEmail.F(e.usernameOrEmail) {
		e.G().Log.Debug("Login: already logged in, but %q email address provided.  Can't determine if that is current user without further work, so just returning LoggedInError")
		return true, libkb.LoggedInError{}
	}
	username, err := e.G().GetUPAKLoader().LookupUsername(ctx.NetContext, e.G().ActiveDevice.UID())
	if err != nil {
		return true, err
	}
	if username.Eq(libkb.NewNormalizedUsername(e.usernameOrEmail)) {
		e.G().Log.Debug("Login: already logged in as %q, returning without error", e.usernameOrEmail)
		return true, nil
	}

	e.G().Log.Debug("Login: logged in already as %q (%q requested), returning LoggedInError", username, e.usernameOrEmail)
	return true, libkb.LoggedInError{}

}

func (e *Login) loginProvisionedDevice(ctx *Context, username string) (bool, error) {
	eng := NewLoginProvisionedDevice(e.G(), username)
	err := RunEngine(eng, ctx)
	if err == nil {
		// login successful
		e.G().Log.Debug("LoginProvisionedDevice.Run() was successful")
		// Note:  LoginProvisionedDevice Run() will send login notifications, no need to
		// send here.
		return true, nil
	}

	// if this device has been provisioned already and there was an error, then
	// return that error.  Otherwise, ignore it and keep going.
	if !e.notProvisionedErr(err) {
		return false, err
	}

	e.G().Log.Debug("loginProvisionedDevice error: %s (not fatal, can continue to provision this device)", err)

	return false, nil
}

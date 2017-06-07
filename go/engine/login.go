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
	if len(e.usernameOrEmail) > 0 && libkb.CheckEmail.F(e.usernameOrEmail) {
		// If e.usernameOrEmail is provided and it is an email address, then
		// loginProvisionedDevice is pointless.  It would return an error,
		// but might as well not even use it.
		e.G().Log.Debug("skipping loginProvisionedDevice since %q provided to Login, which looks like an email address.", e.usernameOrEmail)
	} else {
		// First see if this device is already provisioned and it is possible to log in.
		eng := NewLoginProvisionedDevice(e.G(), e.usernameOrEmail)
		err := RunEngine(eng, ctx)
		if err == nil {
			// login successful
			e.G().Log.Debug("LoginProvisionedDevice.Run() was successful")
			// Note:  LoginProvisionedDevice Run() will send login notifications, no need to
			// send here.
			return nil
		}

		// if this device has been provisioned already and there was an error, then
		// return that error.  Otherwise, ignore it and keep going.
		if !e.notProvisionedErr(err) {
			return err
		}

		e.G().Log.Debug("loginProvisionedDevice error: %s (continuing with device provisioning...)", err)
	}

	e.G().Log.Debug("attempting device provisioning")

	// clear out any existing session:
	e.G().Logout()

	// run the LoginLoadUser sub-engine to load a user
	ueng := newLoginLoadUser(e.G(), e.usernameOrEmail)
	if err := RunEngine(ueng, ctx); err != nil {
		return err
	}

	// make sure the user isn't already provisioned (can
	// get here if usernameOrEmail is an email address
	// for an already provisioned on this device user).
	if ueng.User().HasCurrentDeviceInCurrentInstall() {
		return libkb.DeviceAlreadyProvisionedError{}
	}

	darg := &loginProvisionArg{
		DeviceType: e.deviceType,
		ClientType: e.clientType,
		User:       ueng.User(),
	}
	deng := newLoginProvision(e.G(), darg)
	if err := RunEngine(deng, ctx); err != nil {
		return err
	}

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

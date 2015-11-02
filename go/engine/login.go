// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is the main login engine.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
)

var errNoConfig = errors.New("No user config available")
var errNoDevice = errors.New("No device provisioned locally for this user")

// Login is an engine.
type Login struct {
	libkb.Contextified
	deviceType string
	username   string
}

// NewLogin creates a Login engine.  username is optional.
// deviceType should be libkb.DeviceTypeDesktop or
// libkb.DeviceTypeMobile.
func NewLogin(g *libkb.GlobalContext, deviceType, username string) *Login {
	return &Login{
		Contextified: libkb.NewContextified(g),
		deviceType:   deviceType,
		username:     username,
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
		&LoginCurrentDevice{},
		&LoginProvision{},
	}
}

// Run starts the engine.
func (e *Login) Run(ctx *Context) error {
	// first see if this device is already provisioned and it is possible to log in:
	eng := NewLoginCurrentDevice(e.G(), e.username)
	err := RunEngine(eng, ctx)
	if err == nil {
		// login successful
		e.G().Log.Debug("LoginCurrentDevice.Run() was successful")
		return nil
	}

	// if this device has been provisioned already and there was an error, then
	// return that error.  Otherwise, ignore it and keep going.
	if !e.notProvisionedErr(err) {
		return err
	}

	e.G().Log.Debug("LoginCurrentDevice error: %s (continuing with device provisioning...)", err)

	// this device needs to be provisioned:
	darg := &LoginProvisionArg{
		DeviceType: e.deviceType,
		Username:   e.username,
	}
	deng := NewLoginProvision(e.G(), darg)
	return RunEngine(deng, ctx)
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

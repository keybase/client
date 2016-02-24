// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is the main login engine.

package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

var errNoConfig = errors.New("No user config available")
var errNoDevice = errors.New("No device provisioned locally for this user")

// Login is an engine.
type Login struct {
	libkb.Contextified
	deviceType string
	username   string
	clientType keybase1.ClientType
}

// NewLogin creates a Login engine.  username is optional.
// deviceType should be libkb.DeviceTypeDesktop or
// libkb.DeviceTypeMobile.
func NewLogin(g *libkb.GlobalContext, deviceType string, username string, ct keybase1.ClientType) *Login {
	return &Login{
		Contextified: libkb.NewContextified(g),
		deviceType:   deviceType,
		username:     username,
		clientType:   ct,
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

	sendNotification := func() {
		e.G().NotifyRouter.HandleLogin(string(e.G().Env.GetUsername()))
	}

	// first see if this device is already provisioned and it is possible to log in:
	eng := NewLoginCurrentDevice(e.G(), e.username)
	err := RunEngine(eng, ctx)
	if err == nil {
		// login successful
		e.G().Log.Debug("LoginCurrentDevice.Run() was successful")
		sendNotification()
		return nil
	}

	// if this device has been provisioned already and there was an error, then
	// return that error.  Otherwise, ignore it and keep going.
	if !e.notProvisionedErr(err) {
		return err
	}

	e.G().Log.Debug("LoginCurrentDevice error: %s (continuing with device provisioning...)", err)

	// this device needs to be provisioned

	// clear out any existing session:
	e.G().Logout()

	// transaction around config file
	tx, err := e.G().Env.GetConfigWriter().BeginTransaction()
	if err != nil {
		return err
	}

	// From this point on, if there's an error, we abort the
	// transaction.
	defer func() {
		if tx != nil {
			tx.Abort()
		}
	}()

	// run the username engine to load a user
	ueng := NewLoginUsername(e.G(), e.username)
	if err = RunEngine(ueng, ctx); err != nil {
		return err
	}

	darg := &LoginProvisionArg{
		DeviceType: e.deviceType,
		ClientType: e.clientType,
		User:       ueng.User(),
	}
	deng := NewLoginProvision(e.G(), darg)
	if err = RunEngine(deng, ctx); err != nil {
		return err
	}

	// commit the config changes
	if err := tx.Commit(); err != nil {
		return err
	}

	// Zero out the TX so that we don't abort it in the defer()
	// exit.
	tx = nil

	sendNotification()
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

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// PGPProvision is an engine.
type PGPProvision struct {
	libkb.Contextified
	username    string
	deviceName  string
	fingerprint string
}

// NewPGPProvision creates a PGPProvision engine.
func NewPGPProvision(g *libkb.GlobalContext, username, deviceName, fingerprint string) *PGPProvision {
	return &PGPProvision{
		Contextified: libkb.NewContextified(g),
		username:     username,
		deviceName:   deviceName,
		fingerprint:  fingerprint,
	}
}

// Name is the unique engine name.
func (e *PGPProvision) Name() string {
	return "PGPProvision"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPProvision) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPProvision) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPProvision) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&loginLoadUser{},
	}
}

// Run starts the engine.
func (e *PGPProvision) Run(ctx *Context) error {
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

	// run the LoginLoadUser sub-engine to load a user
	ueng := newLoginLoadUser(e.G(), e.username)
	if err = RunEngine(ueng, ctx); err != nil {
		return err
	}

	// make sure the user isn't already provisioned (can
	// get here if usernameOrEmail is an email address
	// for an already provisioned on this device user).
	if ueng.User().HasCurrentDeviceInCurrentInstall() {
		return libkb.DeviceAlreadyProvisionedError{}
	}
	// e.User = ueng.User()
	return nil
}

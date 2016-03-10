// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// LoginWithPassphrase is an engine that is only meant for use by
// the command line client `keybase login --stdin`.
type LoginWithPassphrase struct {
	libkb.Contextified
	username   string
	passphrase string
}

// NewLoginWithPassphrase creates a LoginWithPassphrase engine.
func NewLoginWithPassphrase(g *libkb.GlobalContext, username, passphrase string) *LoginWithPassphrase {
	return &LoginWithPassphrase{
		Contextified: libkb.NewContextified(g),
		username:     username,
		passphrase:   passphrase,
	}
}

// Name is the unique engine name.
func (e *LoginWithPassphrase) Name() string {
	return "LoginWithPassphrase"
}

// GetPrereqs returns the engine prereqs.
func (e *LoginWithPassphrase) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginWithPassphrase) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginWithPassphrase) SubConsumers() []libkb.UIConsumer {
	// LoginWithPassphrase uses loginProvisionedDevice, but with a passphrase,
	// which changes its RequiredUIs.
	return []libkb.UIConsumer{&loginProvisionedDevice{passphrase: "not empty"}}
}

// Run starts the engine.
func (e *LoginWithPassphrase) Run(ctx *Context) error {
	e.G().Log.Debug("username: %q, passphrase: %q", e.username, e.passphrase)
	eng := newLoginProvisionedDeviceWithPassphrase(e.G(), e.username, e.passphrase)
	return eng.Run(ctx)
}

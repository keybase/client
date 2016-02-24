// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// LoginUsername is an engine that will get a username or email
// address from the user and load that user, for the purposes of
// preparing for provisioning a new device.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// LoginUsername is an engine.
type LoginUsername struct {
	libkb.Contextified
}

// NewLoginUsername creates a LoginUsername engine.
func NewLoginUsername(g *libkb.GlobalContext) *LoginUsername {
	return &LoginUsername{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *LoginUsername) Name() string {
	return "LoginUsername"
}

// GetPrereqs returns the engine prereqs.
func (e *LoginUsername) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginUsername) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginUsername) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *LoginUsername) Run(ctx *Context) error {
	panic("Run not yet implemented")
}

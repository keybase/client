// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is the main login engine.

package engine

import "github.com/keybase/client/go/libkb"

// LoginWithPaperKey is an engine.
type LoginWithPaperKey struct {
	libkb.Contextified
}

// NewLoginWithPaperKey creates a LoginWithPaperKey engine.  username is optional.
// deviceType should be libkb.DeviceTypeDesktop or
// libkb.DeviceTypeMobile.
func NewLoginWithPaperKey(g *libkb.GlobalContext) *LoginWithPaperKey {
	return &LoginWithPaperKey{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *LoginWithPaperKey) Name() string {
	return "LoginWithPaperKey"
}

// GetPrereqs returns the engine prereqs.
func (e *LoginWithPaperKey) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginWithPaperKey) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginWithPaperKey) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
func (e *LoginWithPaperKey) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserForceArg(e.G()))
	if err != nil {
		return err
	}

	kp, err := findPaperKeys(ctx, e.G(), me)

	err = e.G().LoginState().LoginWithKey(ctx.LoginContext, me, kp.sigKey, nil)
	return err
}

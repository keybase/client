// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// Unlock is an engine.
type Unlock struct {
	libkb.Contextified
	passphrase string
}

// NewUnlock creates a Unlock engine.
func NewUnlock(g *libkb.GlobalContext) *Unlock {
	return &Unlock{
		Contextified: libkb.NewContextified(g),
	}
}

// NewUnlock creates a Unlock engine.
func NewUnlockWithPassphrase(g *libkb.GlobalContext, passphrase string) *Unlock {
	return &Unlock{
		Contextified: libkb.NewContextified(g),
		passphrase:   passphrase,
	}
}

// Name is the unique engine name.
func (e *Unlock) Name() string {
	return "Unlock"
}

// GetPrereqs returns the engine prereqs.
func (e *Unlock) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *Unlock) RequiredUIs() []libkb.UIKind {
	if e.passphrase != "" {
		return nil
	}
	return []libkb.UIKind{libkb.SecretUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Unlock) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Unlock) Run(ctx *Context) error {
	if e.passphrase != "" {
		_, err := e.G().LoginState().GetPassphraseStreamWithPassphrase(e.passphrase)
		return err
	}
	_, err := e.G().LoginState().GetPassphraseStream(ctx.SecretUI)
	return err
}

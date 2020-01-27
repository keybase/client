// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// WotAttest is an engine.
type WotAttest struct {
	libkb.Contextified
}

// NewWotAttest creates a WotAttest engine.
func NewWotAttest(g *libkb.GlobalContext) *WotAttest {
	return &WotAttest{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *WotAttest) Name() string {
	return "WotAttest"
}

// GetPrereqs returns the engine prereqs.
func (e *WotAttest) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *WotAttest) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *WotAttest) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *WotAttest) Run(mctx libkb.MetaContext) error {
	return nil
}

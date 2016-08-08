// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// PGPPurge is an engine.
type PGPPurge struct {
	libkb.Contextified
}

// NewPGPPurge creates a PGPPurge engine.
func NewPGPPurge(g *libkb.GlobalContext) *PGPPurge {
	return &PGPPurge{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PGPPurge) Name() string {
	return "PGPPurge"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPPurge) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPPurge) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPPurge) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *PGPPurge) Run(ctx *Context) error {
	return nil
}

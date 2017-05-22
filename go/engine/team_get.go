// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// TeamGet is an engine.
type TeamGet struct {
	libkb.Contextified
}

// NewTeamGet creates a TeamGet engine.
func NewTeamGet(g *libkb.GlobalContext) *TeamGet {
	return &TeamGet{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *TeamGet) Name() string {
	return "TeamGet"
}

// GetPrereqs returns the engine prereqs.
func (e *TeamGet) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
		Device:  true,
	}
}

// RequiredUIs returns the required UIs.
func (e *TeamGet) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *TeamGet) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *TeamGet) Run(ctx *Context) error {
	return nil
}

// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build ignore
//
// This is a template for an engine.
//
// It won't be built, but can be used as a starting point for new
// engines.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// Template is an engine.
type Template struct {
	libkb.Contextified
}

// NewTemplate creates a Template engine.
func NewTemplate(g *libkb.GlobalContext) *Template {
	return &Template{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *Template) Name() string {
	return "Template"
}

// GetPrereqs returns the engine prereqs.
func (e *Template) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Template) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Template) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *Template) Run(ctx *Context) error {
	panic("Run not yet implemented")
}

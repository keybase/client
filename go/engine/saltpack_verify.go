// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
)

// SaltPackVerify is an engine.
type SaltPackVerify struct {
	libkb.Contextified
	arg *SaltPackVerifyArg
}

type SaltPackVerifyArg struct {
	Source    io.Reader
	Signature []byte
	SignedBy  string
}

// NewSaltPackVerify creates a SaltPackVerify engine.
func NewSaltPackVerify(arg *SaltPackVerifyArg, g *libkb.GlobalContext) *SaltPackVerify {
	return &SaltPackVerify{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *SaltPackVerify) Name() string {
	return "SaltPackVerify"
}

// GetPrereqs returns the engine prereqs.
func (e *SaltPackVerify) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltPackVerify) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltPackVerify) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *SaltPackVerify) Run(ctx *Context) error {
	if len(e.arg.Signature) > 0 {
		return e.detached()
	}
	return e.attached()
}

func (e *SaltPackVerify) attached() error {
	return nil
}

func (e *SaltPackVerify) detached() error {
	return nil
}

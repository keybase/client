// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
)

// SaltPackSign is an engine.
type SaltPackSign struct {
	libkb.Contextified
	arg *SaltPackSignArg
	key libkb.NaclSigningKeyPair
}

type SaltPackSignArg struct {
	Sink     io.WriteCloser
	Source   io.ReadCloser
	Detached bool
}

// NewSaltPackSign creates a SaltPackSign engine.
func NewSaltPackSign(arg *SaltPackSignArg, g *libkb.GlobalContext) *SaltPackSign {
	return &SaltPackSign{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *SaltPackSign) Name() string {
	return "SaltPackSign"
}

// GetPrereqs returns the engine prereqs.
func (e *SaltPackSign) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *SaltPackSign) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltPackSign) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *SaltPackSign) Run(ctx *Context) error {
	if err := e.loadKey(ctx); err != nil {
		return err
	}

	// TODO: check detached flag

	return libkb.SaltPackSign(e.G(), e.arg.Source, e.arg.Sink, e.key)
}

func (e *SaltPackSign) loadKey(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}
	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	key, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, ska, ctx.SecretUI, "signing a message/file")
	if err != nil {
		return err
	}
	kp, ok := key.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return libkb.KeyCannotDecryptError{}
	}
	e.key = kp
	return nil
}

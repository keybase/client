// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// SaltpackSign is an engine.
type SaltpackSign struct {
	libkb.Contextified
	arg *SaltpackSignArg
	key libkb.NaclSigningKeyPair
}

type SaltpackSignArg struct {
	Sink   io.WriteCloser
	Source io.ReadCloser
	Opts   keybase1.SaltpackSignOptions
}

// NewSaltpackSign creates a SaltpackSign engine.
func NewSaltpackSign(arg *SaltpackSignArg, g *libkb.GlobalContext) *SaltpackSign {
	return &SaltpackSign{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *SaltpackSign) Name() string {
	return "SaltpackSign"
}

// GetPrereqs returns the engine prereqs.
func (e *SaltpackSign) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *SaltpackSign) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltpackSign) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *SaltpackSign) Run(ctx *Context) error {
	if err := e.loadKey(ctx); err != nil {
		return err
	}

	saltpackVersion, err := libkb.SaltpackVersionFromArg(e.arg.Opts.SaltpackVersion)
	if err != nil {
		return err
	}

	if e.arg.Opts.Detached {
		return libkb.SaltpackSignDetached(e.G(), e.arg.Source, e.arg.Sink, e.key, e.arg.Opts.Binary, saltpackVersion)
	}

	return libkb.SaltpackSign(e.G(), e.arg.Source, e.arg.Sink, e.key, e.arg.Opts.Binary, saltpackVersion)
}

func (e *SaltpackSign) loadKey(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}
	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	key, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "signing a message/file"))
	if err != nil {
		return err
	}
	kp, ok := key.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		return libkb.KeyCannotSignError{}
	}
	e.key = kp
	return nil
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
)

type SaltPackDecryptArg struct {
	Source io.Reader
	Sink   io.WriteCloser
}

// SaltPackDecrypt decrypts data read from a source into a sink.
type SaltPackDecrypt struct {
	arg *SaltPackDecryptArg
	libkb.Contextified
}

// NewSaltPackDecrypt creates a SaltPackDecrypt engine.
func NewSaltPackDecrypt(arg *SaltPackDecryptArg, g *libkb.GlobalContext) *SaltPackDecrypt {
	return &SaltPackDecrypt{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *SaltPackDecrypt) Name() string {
	return "SaltPackDecrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *SaltPackDecrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltPackDecrypt) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltPackDecrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
func (e *SaltPackDecrypt) Run(ctx *Context) (err error) {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	key, err := e.G().Keyrings.GetSecretKeyWithPrompt(
		ctx.LoginContext, ska, ctx.SecretUI,
		"decrypting a message/file")
	if err != nil {
		return err
	}

	kp, ok := key.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		return libkb.KeyCannotDecryptError{}
	}

	return libkb.SaltPackDecrypt(e.arg.Source, e.arg.Sink, kp)
}

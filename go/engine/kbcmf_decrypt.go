// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
)

type KBCMFDecryptArg struct {
	Source io.Reader
	Sink   io.WriteCloser
}

// KBCMFDecrypt decrypts data read from a source into a sink.
type KBCMFDecrypt struct {
	arg *KBCMFDecryptArg
	libkb.Contextified
}

// NewKBCMFDecrypt creates a KBCMFDecrypt engine.
func NewKBCMFDecrypt(arg *KBCMFDecryptArg, g *libkb.GlobalContext) *KBCMFDecrypt {
	return &KBCMFDecrypt{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *KBCMFDecrypt) Name() string {
	return "KBCMFDecrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *KBCMFDecrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *KBCMFDecrypt) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers returns the other UI consumers for this engine.
func (e *KBCMFDecrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
func (e *KBCMFDecrypt) Run(ctx *Context) (err error) {
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

	return libkb.KBCMFDecrypt(e.arg.Source, e.arg.Sink, kp)
}

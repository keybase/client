// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"io"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type KBCMFDecryptArg struct {
	Source       io.Reader
	Sink         io.WriteCloser
	TrackOptions keybase1.TrackOptions
}

// KBCMFDecrypt decrypts data read from a source into a sink.  It will
// track them if necessary.
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
	key, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.LoginContext, ska, ctx.SecretUI, "command-line signature")
	if err != nil {
		return err
	}

	deviceEncryptionKey, ok := key.(libkb.NaclDHKeyPair)
	if !ok {
		return errors.New("Key unexpectedly not a device encryption key")
	}

	return libkb.KBCMFDecrypt(e.arg.Source, e.arg.Sink, deviceEncryptionKey)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/saltpack"
	"golang.org/x/net/context"
	"io"
)

type SaltPackDecryptArg struct {
	Source io.Reader
	Sink   io.WriteCloser
	Opts   keybase1.SaltPackDecryptOptions
}

// SaltPackDecrypt decrypts data read from a source into a sink.
type SaltPackDecrypt struct {
	libkb.Contextified
	arg *SaltPackDecryptArg
}

// NewSaltPackDecrypt creates a SaltPackDecrypt engine.
func NewSaltPackDecrypt(arg *SaltPackDecryptArg, g *libkb.GlobalContext) *SaltPackDecrypt {
	return &SaltPackDecrypt{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
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
	return []libkb.UIKind{
		libkb.SaltPackUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltPackDecrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&SaltPackSenderIdentify{},
	}
}

func (e *SaltPackDecrypt) promptForDecrypt(ctx *Context, mki *saltpack.MessageKeyInfo) (err error) {
	defer e.G().Trace("SaltPackDecrypt::promptForDecrypt", func() error { return err })()

	spsiArg := SaltPackSenderIdentifyArg{
		isAnon:           mki.SenderIsAnon,
		publicKey:        libkb.BoxPublicKeyToKeybaseKID(mki.SenderKey),
		interactive:      e.arg.Opts.Interactive,
		forceRemoteCheck: e.arg.Opts.ForceRemoteCheck,
		reason: keybase1.IdentifyReason{
			Reason: "Identify who encrypted this message",
			Type:   keybase1.IdentifyReasonType_DECRYPT,
		},
	}

	spsiEng := NewSaltPackSenderIdentify(e.G(), &spsiArg)
	if err = RunEngine(spsiEng, ctx); err != nil {
		return err
	}

	arg := keybase1.SaltPackPromptForDecryptArg{
		Sender: spsiEng.Result(),
	}

	err = ctx.SaltPackUI.SaltPackPromptForDecrypt(context.TODO(), arg)
	if err != nil {
		return err
	}
	return err
}

// Run starts the engine.
func (e *SaltPackDecrypt) Run(ctx *Context) (err error) {
	defer e.G().Trace("SaltPackDecrypt::Run", func() error { return err })()

	var me *libkb.User
	me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))

	if err != nil {
		return err
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	e.G().Log.Debug("| GetSecretKeyWithPrompt")
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

	hook := func(mki *saltpack.MessageKeyInfo) error {
		return e.promptForDecrypt(ctx, mki)
	}

	e.G().Log.Debug("| SaltPackDecrypt")
	err = libkb.SaltPackDecrypt(e.arg.Source, e.arg.Sink, kp, hook)
	return err
}

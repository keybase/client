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
	return []libkb.UIKind{
		libkb.SaltPackUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltPackDecrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&Identify2WithUID{},
	}
}

func (e *SaltPackDecrypt) lookupSender(ctx *Context, mki *saltpack.MessageKeyInfo, arg *keybase1.SaltPackPromptForDecryptArg) (err error) {
	defer e.G().Trace("SaltPackDecrypt::lookupSender", func() error { return err })()
	arg.Username, arg.Uid, err = libkb.KeyLookupByBoxPublicKey(e.G(), mki.SenderKey)
	return err
}

func (e *SaltPackDecrypt) identifySender(ctx *Context, arg *keybase1.SaltPackPromptForDecryptArg) (err error) {
	defer e.G().Trace("SaltPackDecrypt::identifySender", func() error { return err })()
	iarg := keybase1.Identify2Arg{
		Uid:                   arg.Uid,
		UseDelegateUI:         !e.arg.Opts.Interactive,
		AlwaysBlock:           e.arg.Opts.Interactive,
		ForceRemoteCheck:      e.arg.Opts.ForceRemoteCheck,
		NoErrorOnTrackFailure: true,
		Reason: keybase1.IdentifyReason{
			Reason: "Identify who encrypted this message",
			Type:   keybase1.IdentifyReasonType_DECRYPT,
		},
	}
	eng := NewIdentify2WithUID(e.G(), &iarg)
	if err = eng.Run(ctx); err != nil {
		return err
	}
	switch eng.getTrackType() {
	case identify2NoTrack:
		arg.SenderType = keybase1.SaltPackSenderType_NOT_TRACKED
	case identify2TrackOK:
		arg.SenderType = keybase1.SaltPackSenderType_TRACKING_OK
	default:
		arg.SenderType = keybase1.SaltPackSenderType_TRACKING_BROKE
	}
	return nil
}

func (e *SaltPackDecrypt) computeSenderArg(ctx *Context, mki *saltpack.MessageKeyInfo, arg *keybase1.SaltPackPromptForDecryptArg) (err error) {
	defer e.G().Trace("SaltPackDecrypt::computeSenderArg", func() error { return err })()
	if mki.SenderIsAnon {
		arg.SenderType = keybase1.SaltPackSenderType_ANONYMOUS
		return
	}

	if err = e.lookupSender(ctx, mki, arg); err != nil {
		if _, ok := err.(libkb.NotFoundError); ok {
			arg.SenderType = keybase1.SaltPackSenderType_UNKNOWN
			err = nil
		}
		return err
	}

	if err = e.identifySender(ctx, arg); err != nil {
		return err
	}
	return
}

func (e *SaltPackDecrypt) promptForDecrypt(ctx *Context, mki *saltpack.MessageKeyInfo) (err error) {
	defer e.G().Trace("SaltPackDecrypt::promptForDecrypt", func() error { return err })()

	arg := keybase1.SaltPackPromptForDecryptArg{}
	if err = e.computeSenderArg(ctx, mki, &arg); err != nil {
		return err
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

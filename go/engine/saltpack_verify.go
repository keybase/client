// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"io"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/saltpack"
)

// SaltpackVerify is an engine.
type SaltpackVerify struct {
	libkb.Contextified
	arg *SaltpackVerifyArg
	key libkb.NaclSigningKeyPair
}

// SaltpackVerifyArg are engine args.
type SaltpackVerifyArg struct {
	Sink   io.WriteCloser
	Source io.Reader
	Opts   keybase1.SaltpackVerifyOptions
}

// NewSaltpackVerify creates a SaltpackVerify engine.
func NewSaltpackVerify(arg *SaltpackVerifyArg, g *libkb.GlobalContext) *SaltpackVerify {
	return &SaltpackVerify{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *SaltpackVerify) Name() string {
	return "SaltpackVerify"
}

// Prereqs returns the engine prereqs.
func (e *SaltpackVerify) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *SaltpackVerify) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.SaltpackUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltpackVerify) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&SaltpackSenderIdentify{}}
}

// Run starts the engine.
func (e *SaltpackVerify) Run(ctx *Context) error {
	if len(e.arg.Opts.Signature) > 0 {
		return e.detached(ctx)
	}
	return e.attached(ctx)
}

func (e *SaltpackVerify) attached(ctx *Context) error {
	hook := func(key saltpack.SigningPublicKey) error {
		return e.identifySender(ctx, key)
	}
	return libkb.SaltpackVerify(e.G(), e.arg.Source, e.arg.Sink, hook)
}

func (e *SaltpackVerify) detached(ctx *Context) error {
	hook := func(key saltpack.SigningPublicKey) error {
		return e.identifySender(ctx, key)
	}
	return libkb.SaltpackVerifyDetached(e.G(), e.arg.Source, e.arg.Opts.Signature, hook)
}

func (e *SaltpackVerify) identifySender(ctx *Context, key saltpack.SigningPublicKey) (err error) {
	defer e.G().Trace("SaltpackVerify::identifySender", func() error { return err })()

	kid := libkb.SigningPublicKeyToKeybaseKID(key)
	spsiArg := SaltpackSenderIdentifyArg{
		publicKey: kid,
		reason: keybase1.IdentifyReason{
			Reason: "Identify who signed this message",
			Type:   keybase1.IdentifyReasonType_VERIFY,
		},
		userAssertion: e.arg.Opts.SignedBy,
	}

	spsiEng := NewSaltpackSenderIdentify(e.G(), &spsiArg)
	if err = RunEngine(spsiEng, ctx); err != nil {
		return err
	}

	if senderTypeIsSuccessful(spsiEng.Result().SenderType) {
		arg := keybase1.SaltpackVerifySuccessArg{
			Sender:     spsiEng.Result(),
			SigningKID: kid,
		}
		return ctx.SaltpackUI.SaltpackVerifySuccess(context.TODO(), arg)
	}

	arg := keybase1.SaltpackVerifyBadSenderArg{
		Sender:     spsiEng.Result(),
		SigningKID: kid,
	}
	// This will return an error if --force is not given.
	return ctx.SaltpackUI.SaltpackVerifyBadSender(context.TODO(), arg)
}

func senderTypeIsSuccessful(senderType keybase1.SaltpackSenderType) bool {
	return (senderType == keybase1.SaltpackSenderType_NOT_TRACKED ||
		senderType == keybase1.SaltpackSenderType_UNKNOWN ||
		senderType == keybase1.SaltpackSenderType_ANONYMOUS ||
		senderType == keybase1.SaltpackSenderType_TRACKING_OK ||
		senderType == keybase1.SaltpackSenderType_SELF)
}

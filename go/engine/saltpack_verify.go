// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"io"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/saltpack"
)

// SaltPackVerify is an engine.
type SaltPackVerify struct {
	libkb.Contextified
	arg *SaltPackVerifyArg
	key libkb.NaclSigningKeyPair
}

type SaltPackVerifyArg struct {
	Source io.Reader
	Opts   keybase1.SaltPackVerifyOptions
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
	return []libkb.UIKind{
		libkb.SaltPackUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *SaltPackVerify) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&SaltPackSenderIdentify{}}
}

// Run starts the engine.
func (e *SaltPackVerify) Run(ctx *Context) error {
	if len(e.arg.Opts.Signature) > 0 {
		return e.detached(ctx)
	}
	return e.attached(ctx)
}

func (e *SaltPackVerify) attached(ctx *Context) error {
	hook := func(key saltpack.SigningPublicKey) error {
		return e.identifySender(ctx, key)
	}
	var buf bytes.Buffer
	return libkb.SaltPackVerify(e.G(), e.arg.Source, libkb.NopWriteCloser{W: &buf}, hook)
}

func (e *SaltPackVerify) detached(ctx *Context) error {
	hook := func(key saltpack.SigningPublicKey) error {
		return e.identifySender(ctx, key)
	}
	return libkb.SaltPackVerifyDetached(e.G(), e.arg.Source, e.arg.Opts.Signature, hook)
}

func (e *SaltPackVerify) identifySender(ctx *Context, key saltpack.SigningPublicKey) (err error) {
	defer e.G().Trace("SaltPackVerify::identifySender", func() error { return err })()

	kid := libkb.SigningPublicKeyToKeybaseKID(key)
	spsiArg := SaltPackSenderIdentifyArg{
		publicKey:   kid,
		interactive: true,
		reason: keybase1.IdentifyReason{
			Reason: "Identify who signed this message",
			Type:   keybase1.IdentifyReasonType_VERIFY,
		},
		userAssertion: e.arg.Opts.SignedBy,
	}

	spsiEng := NewSaltPackSenderIdentify(e.G(), &spsiArg)
	if err = RunEngine(spsiEng, ctx); err != nil {
		return err
	}

	arg := keybase1.SaltPackSignatureSuccessArg{
		Sender:     spsiEng.Result(),
		SigningKID: kid,
	}
	ctx.SaltPackUI.SaltPackSignatureSuccess(context.TODO(), arg)

	return nil
}

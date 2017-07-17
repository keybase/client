// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// PGPKeyGen is an engine.
type PGPKeyGen struct {
	libkb.Contextified
	arg keybase1.PGPKeyGenDefaultArg
}

// NewPGPKeyGen creates a PGPKeyGen engine.
func NewPGPKeyGen(g *libkb.GlobalContext, arg keybase1.PGPKeyGenDefaultArg) *PGPKeyGen {
	return &PGPKeyGen{
		Contextified: libkb.NewContextified(g),
		arg:          arg,
	}
}

// Name is the unique engine name.
func (e *PGPKeyGen) Name() string {
	return "PGPKeyGen"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPKeyGen) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PGPKeyGen) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.PgpUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPKeyGen) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&PGPKeyImportEngine{},
	}
}

// Run starts the engine.
func (e *PGPKeyGen) Run(ctx *Context) error {

	// generate a new pgp key with defaults (and no push)
	arg := PGPKeyImportEngineArg{
		Ctx:        e.G(),
		AllowMulti: true,
		OnlySave:   true,
		Gen:        &libkb.PGPGenArg{Ids: libkb.ImportPGPIdentities(e.arg.CreateUids.Ids)},
	}
	eng := NewPGPKeyImportEngine(arg)
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}

	// tell the UI about the key
	e.G().Log.Debug("generated pgp key: %s", eng.bundle.GetFingerprint())
	pub, err := eng.bundle.Encode()
	if err != nil {
		return err
	}
	keyArg := keybase1.KeyGeneratedArg{
		Kid: eng.bundle.GetKID(),
		Key: keybase1.KeyInfo{
			Fingerprint: eng.bundle.GetFingerprint().String(),
			Key:         pub,
			Desc:        eng.bundle.VerboseDescription(),
		},
	}
	if err := ctx.PgpUI.KeyGenerated(ctx.NetContext, keyArg); err != nil {
		return err
	}

	// ask if we should push private key to api server
	pushPrivate, err := ctx.PgpUI.ShouldPushPrivate(ctx.NetContext, ctx.SessionID)
	if err != nil {
		return err
	}

	e.G().Log.Debug("push private generated pgp key to API server? %v", pushPrivate)
	if err := e.push(ctx, eng.bundle, pushPrivate); err != nil {
		return err
	}

	// tell ui everything finished
	return ctx.PgpUI.Finished(ctx.NetContext, ctx.SessionID)
}

func (e *PGPKeyGen) push(ctx *Context, bundle *libkb.PGPKeyBundle, pushPrivate bool) (err error) {
	e.G().Trace("PGPKeyGen.push", func() error { return err })()

	tsec, gen, err := e.G().LoginState().GetVerifiedTriplesec(ctx.SecretUI)
	if err != nil {
		return err
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(e.G()))
	if err != nil {
		return err
	}

	del := &libkb.Delegator{
		Me:             me,
		Expire:         libkb.KeyExpireIn,
		DelegationType: libkb.DelegationTypeSibkey,
		Contextified:   libkb.NewContextified(e.G()),
	}
	if err := del.LoadSigningKey(ctx.LoginContext, ctx.SecretUI); err != nil {
		return err
	}
	del.NewKey = bundle

	if pushPrivate {
		skb, err := bundle.ToServerSKB(e.G(), tsec, gen)
		if err != nil {
			return err
		}

		armored, err := skb.ArmoredEncode()
		if err != nil {
			return err
		}
		del.EncodedPrivateKey = armored
	}

	if err := del.Run(ctx.LoginContext); err != nil {
		return err
	}

	return nil
}

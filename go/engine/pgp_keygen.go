// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// PGPKeyGen is an engine.
type PGPKeyGen struct {
	libkb.Contextified
	arg    keybase1.PGPKeyGenDefaultArg
	genArg *libkb.PGPGenArg
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
func (e *PGPKeyGen) Run(m libkb.MetaContext) error {

	// generate a new pgp key with defaults (and no push)
	var genArg libkb.PGPGenArg
	if e.genArg != nil {
		genArg = *e.genArg
	}
	genArg.Ids = libkb.ImportPGPIdentities(e.arg.CreateUids.Ids)
	arg := PGPKeyImportEngineArg{
		AllowMulti: true,
		OnlySave:   true,
		Gen:        &genArg,
	}
	eng := NewPGPKeyImportEngine(m.G(), arg)
	if err := RunEngine2(m, eng); err != nil {
		return err
	}

	// tell the UI about the key
	m.Debug("generated pgp key: %s", eng.bundle.GetFingerprint())
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
	if err := m.UIs().PgpUI.KeyGenerated(m.Ctx(), keyArg); err != nil {
		return err
	}

	// ask if we should push private key to api server if user has a password
	hasRandomPw, err := libkb.LoadHasRandomPw(m, keybase1.LoadHasRandomPwArg{})
	if err != nil {
		return err
	}
	pushPrivate, err := m.UIs().PgpUI.ShouldPushPrivate(m.Ctx(), keybase1.ShouldPushPrivateArg{
		SessionID: m.UIs().SessionID,
		Prompt:    !hasRandomPw,
	})
	if err != nil {
		return err
	}

	m.Debug("push private generated pgp key to API server? %v", pushPrivate)
	if err := e.push(m, eng.bundle, pushPrivate); err != nil {
		return err
	}

	// tell ui everything finished
	return m.UIs().PgpUI.Finished(m.Ctx(), m.UIs().SessionID)
}

func (e *PGPKeyGen) push(m libkb.MetaContext, bundle *libkb.PGPKeyBundle, pushPrivate bool) (err error) {
	defer m.Trace("PGPKeyGen.push", func() error { return err })()

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m).WithPublicKeyOptional())
	if err != nil {
		return err
	}

	del := &libkb.Delegator{
		Me:             me,
		Expire:         libkb.KeyExpireIn,
		DelegationType: libkb.DelegationTypeSibkey,
		Contextified:   libkb.NewContextified(m.G()),
	}
	if err := del.LoadSigningKey(m, m.UIs().SecretUI); err != nil {
		return err
	}
	del.NewKey = bundle

	if pushPrivate {
		tsec, gen, err := libkb.GetTriplesecMaybePrompt(m)
		if err != nil {
			return err
		}

		skb, err := bundle.ToServerSKB(m.G(), tsec, gen)
		if err != nil {
			return err
		}

		armored, err := skb.ArmoredEncode()
		if err != nil {
			return err
		}
		del.EncodedPrivateKey = armored
	}

	return del.Run(m)
}

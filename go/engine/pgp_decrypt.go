// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type PGPDecryptArg struct {
	Source       io.Reader
	Sink         io.WriteCloser
	AssertSigned bool
	SignedBy     string
}

// PGPDecrypt decrypts data read from source into sink for the
// logged in user.
type PGPDecrypt struct {
	libkb.Contextified
	arg        *PGPDecryptArg
	signStatus *libkb.SignatureStatus
	signer     *libkb.User
}

// NewPGPDecrypt creates a PGPDecrypt engine.
func NewPGPDecrypt(arg *PGPDecryptArg, g *libkb.GlobalContext) *PGPDecrypt {
	return &PGPDecrypt{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PGPDecrypt) Name() string {
	return "PGPDecrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPDecrypt) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPDecrypt) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.SecretUIKind, libkb.LogUIKind, libkb.PgpUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPDecrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&ScanKeys{},
		&ResolveThenIdentify2{},
	}
}

// Run starts the engine.
func (e *PGPDecrypt) Run(ctx *Context) (err error) {
	defer e.G().Trace("PGPDecrypt::Run", func() error { return err })()

	e.G().Log.Debug("| ScanKeys")
	sk, err := NewScanKeys(ctx.SecretUI, e.G())
	if err != nil {
		return err
	}
	e.G().Log.Debug("| PGPDecrypt")
	e.signStatus, err = libkb.PGPDecrypt(e.G(), e.arg.Source, e.arg.Sink, sk)
	if err != nil {
		return err
	}

	e.G().Log.Debug("| Sink Close")
	if err = e.arg.Sink.Close(); err != nil {
		return err
	}

	// get the owner of the signing key
	e.signer = sk.KeyOwner(e.signStatus.KeyID)

	if len(e.arg.SignedBy) > 0 {
		e.arg.AssertSigned = true
	}

	if !e.signStatus.IsSigned {
		if !e.arg.AssertSigned {
			return nil
		}
		return libkb.BadSigError{E: "no signature in message"}
	}
	if !e.signStatus.Verified {
		return e.signStatus.SignatureError
	}

	// message is signed and verified

	if len(e.arg.SignedBy) > 0 {
		if e.signer == nil {
			return libkb.BadSigError{
				E: fmt.Sprintf("Signer not a keybase user, cannot match signed by assertion %q", e.arg.SignedBy),
			}
		}

		// identify the SignedBy assertion
		arg := keybase1.Identify2Arg{
			UserAssertion: e.arg.SignedBy,
			AlwaysBlock:   true,
			NeedProofSet:  true,
			NoSkipSelf:    true,
		}
		eng := NewResolveThenIdentify2(e.G(), &arg)
		if err := RunEngine(eng, ctx); err != nil {
			return err
		}
		signByUser := eng.Result().Upk

		if !signByUser.Uid.Equal(e.signer.GetUID()) {
			return libkb.BadSigError{
				E: fmt.Sprintf("Signer %q did not match signed by assertion %q", e.signer.GetName(), e.arg.SignedBy),
			}
		}
	} else {
		if e.signer == nil {
			// signer isn't a keybase user
			e.G().Log.Debug("message signed by key unknown to keybase: %X", e.signStatus.KeyID)
			OutputSignatureSuccessNonKeybase(ctx, e.signStatus.KeyID, e.signStatus.SignatureTime)
			return nil
		}

		// identify the signer
		arg := keybase1.Identify2Arg{
			UserAssertion: e.signer.GetName(),
			AlwaysBlock:   true,
			NeedProofSet:  true,
			NoSkipSelf:    true,
		}
		eng := NewResolveThenIdentify2(e.G(), &arg)
		if err := RunEngine(eng, ctx); err != nil {
			return err
		}
	}

	if e.signStatus.Entity == nil {
		return libkb.NoKeyError{Msg: fmt.Sprintf("In signature verification: no public key found for PGP ID %x", e.signStatus.KeyID)}
	}

	if entity := e.signStatus.Entity; len(entity.UnverifiedRevocations) > 0 {
		return libkb.BadSigError{
			E: fmt.Sprintf("Key %x belonging to %q has been revoked by its designated revoker.", entity.PrimaryKey.KeyId, e.signer.GetName()),
		}
	}

	bundle := libkb.NewPGPKeyBundle(e.signStatus.Entity)
	OutputSignatureSuccess(ctx, bundle.GetFingerprint(), e.signer, e.signStatus.SignatureTime)
	return nil
}

func (e *PGPDecrypt) SignatureStatus() *libkb.SignatureStatus {
	return e.signStatus
}

func (e *PGPDecrypt) Signer() *libkb.User {
	return e.signer
}

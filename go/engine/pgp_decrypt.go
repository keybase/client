// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"
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
	owner      *libkb.User
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
		&Identify{},
	}
}

// Run starts the engine.
func (e *PGPDecrypt) Run(ctx *Context) (err error) {
	e.G().Log.Debug("+ PGPDecrypt::Run")
	defer func() {
		e.G().Log.Debug("- PGPDecrypt::Run %s", err)
	}()

	e.G().Log.Debug("| ScanKeys")

	sk, err := NewScanKeys(ctx.SecretUI, e.G())
	if err != nil {
		return err
	}
	e.G().Log.Debug("| PGPDecrypt")
	e.signStatus, err = libkb.PGPDecrypt(e.arg.Source, e.arg.Sink, sk)
	if err != nil {
		return err
	}

	e.G().Log.Debug("| Sink Close")
	if err = e.arg.Sink.Close(); err != nil {
		return err
	}

	e.owner = sk.Owner()

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
		// identify the SignedBy assertion
		arg := NewIdentifyArg(e.arg.SignedBy, false, false)
		eng := NewIdentify(arg, e.G())
		if err := RunEngine(eng, ctx); err != nil {
			return err
		}
		signByUser := eng.User()
		if signByUser == nil {
			// this shouldn't happen (engine should return an error in this state)
			// but just in case:
			return libkb.ErrNilUser
		}

		if !signByUser.Equal(e.owner) {
			return libkb.BadSigError{
				E: fmt.Sprintf("Signer %q did not match signed by assertion %q", e.owner.GetName(), e.arg.SignedBy),
			}
		}
	} else {
		// identify the signer
		arg := NewIdentifyArg(e.owner.GetName(), false, false)
		eng := NewIdentify(arg, e.G())
		if err := RunEngine(eng, ctx); err != nil {
			return err
		}
	}

	if e.signStatus.Entity == nil {
		return libkb.NoKeyError{Msg: fmt.Sprintf("In signature verification: no public key found for PGP ID %x", e.signStatus.KeyID)}
	}

	bundle := libkb.NewPGPKeyBundle(e.signStatus.Entity)
	OutputSignatureSuccess(ctx, bundle.GetFingerprint(), e.owner, e.signStatus.SignatureTime)
	return nil
}

func (e *PGPDecrypt) SignatureStatus() *libkb.SignatureStatus {
	return e.signStatus
}

func (e *PGPDecrypt) Owner() *libkb.User {
	return e.owner
}

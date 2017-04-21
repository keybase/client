// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/ioutil"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-crypto/openpgp"
	"github.com/keybase/go-crypto/openpgp/armor"
	"github.com/keybase/go-crypto/openpgp/clearsign"
	"github.com/keybase/go-crypto/openpgp/packet"
)

type PGPVerifyArg struct {
	Source    io.Reader
	Signature []byte
	SignedBy  string
}

// PGPVerify is an engine.
type PGPVerify struct {
	arg        *PGPVerifyArg
	source     io.Reader
	signStatus *libkb.SignatureStatus
	signer     *libkb.User
	libkb.Contextified
}

// NewPGPVerify creates a PGPVerify engine.
func NewPGPVerify(arg *PGPVerifyArg, g *libkb.GlobalContext) *PGPVerify {
	return &PGPVerify{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PGPVerify) Name() string {
	return "PGPVerify"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPVerify) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPVerify) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.PgpUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPVerify) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&PGPDecrypt{},
		&ScanKeys{},
		&ResolveThenIdentify2{},
	}
}

// Run starts the engine.
func (e *PGPVerify) Run(ctx *Context) error {
	var err error
	defer e.G().Trace("PGPVerify::Run", func() error { return err })()
	var sc libkb.StreamClassification
	sc, e.source, err = libkb.ClassifyStream(e.arg.Source)

	// For a Detached signature, we'll be expecting an UnknownStreamError
	if err != nil {
		if _, ok := err.(libkb.UnknownStreamError); !ok || len(e.arg.Signature) == 0 {
			return err
		}
	}

	if sc.Format == libkb.CryptoMessageFormatPGP && sc.Type == libkb.CryptoMessageTypeClearSignature {
		err = e.runClearsign(ctx)
		return err
	}
	if len(e.arg.Signature) == 0 {
		err = e.runAttached(ctx)
		return err
	}
	err = e.runDetached(ctx)
	return err
}

func (e *PGPVerify) SignatureStatus() *libkb.SignatureStatus {
	return e.signStatus
}

func (e *PGPVerify) Signer() *libkb.User {
	return e.signer
}

// runAttached verifies an attached signature
func (e *PGPVerify) runAttached(ctx *Context) error {
	arg := &PGPDecryptArg{
		Source:       e.source,
		Sink:         libkb.NopWriteCloser{W: ioutil.Discard},
		AssertSigned: true,
		SignedBy:     e.arg.SignedBy,
	}
	eng := NewPGPDecrypt(arg, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}
	e.signStatus = eng.SignatureStatus()
	e.signer = eng.Signer()

	return nil
}

// runDetached verifies a detached signature
func (e *PGPVerify) runDetached(ctx *Context) error {
	sk, err := NewScanKeys(ctx.SecretUI, e.G())
	if err != nil {
		return err
	}
	checkfn := openpgp.CheckDetachedSignature
	if libkb.IsArmored(e.arg.Signature) {
		checkfn = openpgp.CheckArmoredDetachedSignature
	}
	signer, err := checkfn(sk, e.source, bytes.NewReader(e.arg.Signature))
	if err != nil {
		return err
	}

	e.signer = sk.KeyOwnerByEntity(signer)
	e.signStatus = &libkb.SignatureStatus{IsSigned: true}

	if signer != nil {
		e.signStatus.Verified = true
		e.signStatus.Entity = signer
		if err := e.checkSignedBy(ctx); err != nil {
			return err
		}

		var r io.Reader = bytes.NewReader(e.arg.Signature)
		if libkb.IsArmored(e.arg.Signature) {
			block, err := armor.Decode(r)
			if err != nil {
				return err
			}
			r = block.Body
		}

		p, err := packet.Read(r)
		if err != nil {
			return err
		}

		if val, ok := p.(*packet.Signature); ok {
			e.signStatus.SignatureTime = val.CreationTime
		}

		fingerprint := libkb.PGPFingerprint(signer.PrimaryKey.Fingerprint)
		OutputSignatureSuccess(ctx, fingerprint, e.signer, e.signStatus.SignatureTime)
	}

	return nil
}

// runClearsign verifies a clearsign signature
func (e *PGPVerify) runClearsign(ctx *Context) error {
	// clearsign decode only works with the whole data slice, not a reader
	// so have to read it all here:
	msg, err := ioutil.ReadAll(e.source)
	if err != nil {
		return err
	}
	b, _ := clearsign.Decode(msg)
	if b == nil {
		return errors.New("Unable to decode clearsigned message")
	}

	sigBody, err := ioutil.ReadAll(b.ArmoredSignature.Body)
	if err != nil {
		return err
	}

	sk, err := NewScanKeys(ctx.SecretUI, e.G())
	if err != nil {
		return err
	}

	signer, err := openpgp.CheckDetachedSignature(sk, bytes.NewReader(b.Bytes), bytes.NewReader(sigBody))
	if err != nil {
		return fmt.Errorf("Check sig error: %s", err)
	}

	e.signer = sk.KeyOwnerByEntity(signer)
	e.signStatus = &libkb.SignatureStatus{IsSigned: true}

	if signer != nil {
		if len(signer.UnverifiedRevocations) > 0 {
			return libkb.BadSigError{
				E: fmt.Sprintf("Key %x belonging to %q has been revoked by its designated revoker.", signer.PrimaryKey.KeyId, e.signer.GetName()),
			}
		}

		e.signStatus.Verified = true
		e.signStatus.Entity = signer
		if err := e.checkSignedBy(ctx); err != nil {
			return err
		}

		p, err := packet.Read(bytes.NewReader(sigBody))
		if err != nil {
			return err
		}

		if val, ok := p.(*packet.Signature); ok {
			e.signStatus.SignatureTime = val.CreationTime
		}

		fingerprint := libkb.PGPFingerprint(signer.PrimaryKey.Fingerprint)
		OutputSignatureSuccess(ctx, fingerprint, e.signer, e.signStatus.SignatureTime)
	}

	return nil
}

func (e *PGPVerify) checkSignedBy(ctx *Context) error {
	if len(e.arg.SignedBy) == 0 {
		// no assertion necessary
		return nil
	}
	if !e.signStatus.Verified || e.signStatus.Entity == nil || e.signer == nil {
		// signature not valid, so no need to assert
		return nil
	}

	// have: a valid signature, the signature's owner, and a user assertion to
	// match against
	e.G().Log.Debug("checking signed by assertion: %q", e.arg.SignedBy)

	// load the user in SignedBy
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

	// check if it is equal to signature owner
	if !e.signer.GetUID().Equal(signByUser.Uid) {
		return libkb.BadSigError{
			E: fmt.Sprintf("Signer %q did not match signed by assertion %q", e.signer.GetName(), e.arg.SignedBy),
		}
	}

	return nil
}

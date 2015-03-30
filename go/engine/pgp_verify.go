package engine

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/ioutil"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/clearsign"
)

type PGPVerifyArg struct {
	Source       io.Reader
	Signature    []byte
	TrackOptions TrackOptions
}

// PGPVerify is an engine.
type PGPVerify struct {
	arg        *PGPVerifyArg
	peek       *libkb.Peeker
	signStatus *libkb.SignatureStatus
	owner      *libkb.User
	libkb.Contextified
}

// NewPGPVerify creates a PGPVerify engine.
func NewPGPVerify(arg *PGPVerifyArg) *PGPVerify {
	return &PGPVerify{arg: arg}
}

// Name is the unique engine name.
func (e *PGPVerify) Name() string {
	return "PGPVerify"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPVerify) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPVerify) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPVerify) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&PGPDecrypt{},
		&ScanKeys{},
	}
}

// Run starts the engine.
func (e *PGPVerify) Run(ctx *Context) error {
	e.peek = libkb.NewPeeker(e.arg.Source)
	if libkb.IsClearsign(e.peek) {
		return e.runClearsign(ctx)
	}
	if len(e.arg.Signature) == 0 {
		return e.runAttached(ctx)
	}
	return e.runDetached(ctx)
}

func (e *PGPVerify) SignatureStatus() *libkb.SignatureStatus {
	return e.signStatus
}

func (e *PGPVerify) Owner() *libkb.User {
	return e.owner
}

// runAttached verifies an attached signature
func (e *PGPVerify) runAttached(ctx *Context) error {
	arg := &PGPDecryptArg{
		Source:       e.peek,
		Sink:         ioutil.Discard,
		AssertSigned: true,
		TrackOptions: e.arg.TrackOptions,
	}
	eng := NewPGPDecrypt(arg)
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}
	e.signStatus = eng.SignatureStatus()
	e.owner = eng.Owner()
	return nil
}

// runDetached verifies a detached signature
func (e *PGPVerify) runDetached(ctx *Context) error {
	sk, err := NewScanKeys(ctx.SecretUI, ctx.IdentifyUI, &e.arg.TrackOptions)
	if err != nil {
		return err
	}
	checkfn := openpgp.CheckDetachedSignature
	if libkb.IsArmored(e.arg.Signature) {
		checkfn = openpgp.CheckArmoredDetachedSignature
	}
	signer, err := checkfn(sk, e.peek, bytes.NewReader(e.arg.Signature))
	if err != nil {
		return err
	}

	e.owner = sk.Owner()
	e.signStatus = &libkb.SignatureStatus{IsSigned: true}

	if signer != nil {
		e.signStatus.Verified = true
		e.signStatus.Entity = signer
		e.outputSuccess(ctx, signer, sk.Owner())
	}

	return nil
}

// runClearsign verifies a clearsign signature
func (e *PGPVerify) runClearsign(ctx *Context) error {
	// clearsign decode only works with the whole data slice, not a reader
	// so have to read it all here:
	msg, err := ioutil.ReadAll(e.peek)
	if err != nil {
		return err
	}
	b, _ := clearsign.Decode(msg)
	if b == nil {
		return errors.New("Unable to decode clearsigned message")
	}

	sk, err := NewScanKeys(ctx.SecretUI, ctx.IdentifyUI, &e.arg.TrackOptions)
	if err != nil {
		return err
	}
	signer, err := openpgp.CheckDetachedSignature(sk, bytes.NewReader(b.Bytes), b.ArmoredSignature.Body)
	if err != nil {
		return fmt.Errorf("Check sig error: %s", err)
	}

	e.owner = sk.Owner()
	e.signStatus = &libkb.SignatureStatus{IsSigned: true}

	if signer != nil {
		e.signStatus.Verified = true
		e.signStatus.Entity = signer
		e.outputSuccess(ctx, signer, sk.Owner())
	}
	return nil
}

func (e *PGPVerify) outputSuccess(ctx *Context, signer *openpgp.Entity, owner *libkb.User) {
	bundle := (*libkb.PgpKeyBundle)(signer)
	ctx.LogUI.Notice("Signature verified.  Signed by %s.  PGP Fingerprint: %s", owner.GetName(), bundle.GetFingerprint())
}

package engine

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/ioutil"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/armor"
	"golang.org/x/crypto/openpgp/clearsign"
	"golang.org/x/crypto/openpgp/packet"
)

type PGPVerifyArg struct {
	Source       io.Reader
	Signature    []byte
	SignedBy     string
	TrackOptions keybase1.TrackOptions
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
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPVerify) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&PGPDecrypt{},
		&ScanKeys{},
		&Identify{},
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
		Sink:         libkb.NopWriteCloser{W: ioutil.Discard},
		AssertSigned: true,
		TrackOptions: e.arg.TrackOptions,
	}
	eng := NewPGPDecrypt(arg, e.G())
	if err := RunEngine(eng, ctx); err != nil {
		return err
	}
	e.signStatus = eng.SignatureStatus()
	e.owner = eng.Owner()

	if err := e.checkSignedBy(ctx); err != nil {
		return err
	}

	return nil
}

// runDetached verifies a detached signature
func (e *PGPVerify) runDetached(ctx *Context) error {
	sk, err := NewScanKeys(ctx.SecretUI, ctx.IdentifyUI, &e.arg.TrackOptions, e.G())
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
		OutputSignatureSuccess(ctx, fingerprint, sk.Owner(), e.signStatus.SignatureTime)
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

	sigBody, err := ioutil.ReadAll(b.ArmoredSignature.Body)
	if err != nil {
		return err
	}

	sk, err := NewScanKeys(ctx.SecretUI, ctx.IdentifyUI, &e.arg.TrackOptions, e.G())
	if err != nil {
		return err
	}

	signer, err := openpgp.CheckDetachedSignature(sk, bytes.NewReader(b.Bytes), bytes.NewReader(sigBody))
	if err != nil {
		return fmt.Errorf("Check sig error: %s", err)
	}

	e.owner = sk.Owner()
	e.signStatus = &libkb.SignatureStatus{IsSigned: true}

	if signer != nil {
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
		OutputSignatureSuccess(ctx, fingerprint, sk.Owner(), e.signStatus.SignatureTime)
	}

	return nil
}

func (e *PGPVerify) checkSignedBy(ctx *Context) error {
	if len(e.arg.SignedBy) == 0 {
		// no assertion necessary
		return nil
	}
	if !e.signStatus.Verified || e.signStatus.Entity == nil || e.owner == nil {
		// signature not valid, so no need to assert
		return nil
	}

	// have: a valid signature, the signature's owner, and a user assertion to
	// match against
	e.G().Log.Debug("checking signed by assertion: %q", e.arg.SignedBy)

	// load the user in SignedBy
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

	// check if it is equal to signature owner
	if !e.owner.Equal(signByUser) {
		return libkb.BadSigError{
			E: fmt.Sprintf("Signer %q did not match signed by assertion %q", e.owner.GetName(), e.arg.SignedBy),
		}
	}

	return nil
}

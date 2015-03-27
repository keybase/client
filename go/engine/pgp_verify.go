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
	Clearsign    bool // Source is a clearsign message
	TrackOptions TrackOptions
}

// PGPVerify is an engine.
type PGPVerify struct {
	arg *PGPVerifyArg
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
	if e.arg.Clearsign {
		return e.runClearsign(ctx)
	}
	if len(e.arg.Signature) == 0 {
		return e.runAttached(ctx)
	}
	return e.runDetach(ctx)
}

// runAttached verifies an attached signature
func (e *PGPVerify) runAttached(ctx *Context) error {
	arg := &PGPDecryptArg{
		Source:       e.arg.Source,
		Sink:         ioutil.Discard,
		AssertSigned: true,
		TrackOptions: e.arg.TrackOptions,
	}
	eng := NewPGPDecrypt(arg)
	return RunEngine(eng, ctx)
}

// runDetach verifies a detached signature
func (e *PGPVerify) runDetach(ctx *Context) error {
	sk, err := NewScanKeys(ctx.SecretUI, ctx.IdentifyUI, &e.arg.TrackOptions)
	if err != nil {
		return err
	}
	checkfn := openpgp.CheckDetachedSignature
	if libkb.IsArmored(e.arg.Signature) {
		checkfn = openpgp.CheckArmoredDetachedSignature
	}
	signer, err := checkfn(sk, e.arg.Source, bytes.NewReader(e.arg.Signature))
	if err != nil {
		return err
	}
	if signer != nil {
		e.outputSuccess(ctx)
	}

	return nil
}

// runClearsign verifies a clearsign signature
func (e *PGPVerify) runClearsign(ctx *Context) error {
	// clearsign decode only works with the whole data slice, not a reader
	// so have to read it all here:
	msg, err := ioutil.ReadAll(e.arg.Source)
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
	if signer != nil {
		e.outputSuccess(ctx)
	}
	return nil
}

func (e *PGPVerify) outputSuccess(ctx *Context) {
	ctx.LogUI.Notice("Signature verified.")
}

package engine

import (
	"bytes"
	"io"
	"io/ioutil"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/openpgp"
)

type PGPVerifyArg struct {
	Source       io.Reader
	Signature    []byte
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
	// XXX PC: don't think this should be necessary for detached
	return EnginePrereqs{Session: true}
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
	if len(e.arg.Signature) == 0 {
		return e.runEmbed(ctx)
	}
	return e.runDetach(ctx)
}

// runEmbed verifies an embedded signature
func (e *PGPVerify) runEmbed(ctx *Context) error {
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
	// XXX I imagine this should work logged out, so we might need a different version of
	// scankeys.
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}
	sk, err := NewScanKeys(me, ctx.SecretUI, ctx.IdentifyUI, &e.arg.TrackOptions)
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
		ctx.LogUI.Notice("Signature verified.")
	}

	return nil
}

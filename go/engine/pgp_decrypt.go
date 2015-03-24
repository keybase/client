package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
)

type PGPDecryptArg struct {
	Source io.Reader
	Sink   io.Writer
}

// PGPDecrypt decrypts data read from source into sink for the
// logged in user.
type PGPDecrypt struct {
	arg *PGPDecryptArg
	libkb.Contextified
}

// NewPGPDecrypt creates a PGPDecrypt engine.
func NewPGPDecrypt(arg *PGPDecryptArg) *PGPDecrypt {
	return &PGPDecrypt{arg: arg}
}

// Name is the unique engine name.
func (e *PGPDecrypt) Name() string {
	return "PGPDecrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPDecrypt) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (e *PGPDecrypt) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.SecretUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPDecrypt) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *PGPDecrypt) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}
	sk, err := libkb.NewScanKeys(me, ctx.SecretUI)
	if err != nil {
		return err
	}
	return libkb.PGPDecrypt(e.arg.Source, e.arg.Sink, sk)
}

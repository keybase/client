package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
)

type PGPDecryptArg struct {
	Source       io.Reader
	Sink         io.Writer
	AssertSigned bool
	TrackOptions TrackOptions
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
	return []libkb.UIKind{libkb.SecretUIKind, libkb.LogUIKind}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPDecrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&ScanKeys{},
	}
}

// Run starts the engine.
func (e *PGPDecrypt) Run(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return err
	}
	sk, err := NewScanKeys(me, ctx.SecretUI, ctx.IdentifyUI, &e.arg.TrackOptions)
	if err != nil {
		return err
	}
	signStatus, err := libkb.PGPDecrypt(e.arg.Source, e.arg.Sink, sk)
	if err != nil {
		return err
	}

	if !e.arg.AssertSigned {
		G.Log.Debug("Not checking signature status (AssertSigned == false)")
		return nil
	}

	G.Log.Debug("PGPDecrypt: me = %s", me.GetName())
	G.Log.Debug("PGPDecrypt: signStatus: %+v", signStatus)

	if !signStatus.IsSigned {
		return libkb.BadSigError{E: "no signature in message"}
	}
	if !signStatus.Verified {
		return signStatus.SignatureError
	}

	ctx.LogUI.Notice("Signature verified")

	return nil
}

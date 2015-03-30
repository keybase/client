package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
)

type PGPDecryptArg struct {
	Source       io.Reader
	Sink         io.Writer
	AssertSigned bool
	SignedBy     string
	TrackOptions TrackOptions
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
func NewPGPDecrypt(arg *PGPDecryptArg) *PGPDecrypt {
	return &PGPDecrypt{arg: arg}
}

// Name is the unique engine name.
func (e *PGPDecrypt) Name() string {
	return "PGPDecrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPDecrypt) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
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
	sk, err := NewScanKeys(ctx.SecretUI, ctx.IdentifyUI, &e.arg.TrackOptions)
	if err != nil {
		return err
	}
	e.signStatus, err = libkb.PGPDecrypt(e.arg.Source, e.arg.Sink, sk)
	if err != nil {
		return err
	}

	if !e.arg.AssertSigned {
		G.Log.Debug("Not checking signature status (AssertSigned == false)")
		return nil
	}

	G.Log.Debug("PGPDecrypt: signStatus: %+v", e.signStatus)

	if !e.signStatus.IsSigned {
		return libkb.BadSigError{E: "no signature in message"}
	}
	if !e.signStatus.Verified {
		return e.signStatus.SignatureError
	}

	e.owner = sk.Owner()
	bundle := (*libkb.PgpKeyBundle)(e.signStatus.Entity)

	ctx.LogUI.Notice("Signature verified.  Signed by %s.  PGP Fingerprint: %s.", e.owner.GetName(), bundle.GetFingerprint())

	return nil
}

func (e *PGPDecrypt) SignatureStatus() *libkb.SignatureStatus {
	return e.signStatus
}

func (e *PGPDecrypt) Owner() *libkb.User {
	return e.owner
}

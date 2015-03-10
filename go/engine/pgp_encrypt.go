package engine

import (
	"io"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/openpgp"
)

type PGPEncryptArg struct {
	Source     io.Reader
	Sink       io.Writer
	Signer     *libkb.PgpKeyBundle
	Recipients []*libkb.PgpKeyBundle
	Sign       bool
}

type PGPEncrypt struct {
	arg *PGPEncryptArg
}

// NewPGPEncrypt creates a PGPEncrypt engine.
func NewPGPEncrypt(arg *PGPEncryptArg) *PGPEncrypt {
	return &PGPEncrypt{arg: arg}
}

// Name is the unique engine name.
func (e *PGPEncrypt) Name() string {
	return "PGPEncrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPEncrypt) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPEncrypt) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPEncrypt) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *PGPEncrypt) Run(ctx *Context, args, reply interface{}) error {
	to := make([]*openpgp.Entity, len(e.arg.Recipients))
	for i, r := range e.arg.Recipients {
		to[i] = (*openpgp.Entity)(r)
	}
	w, err := openpgp.Encrypt(e.arg.Sink, to, (*openpgp.Entity)(e.arg.Signer), nil, nil)
	if err != nil {
		return err
	}
	n, err := io.Copy(w, e.arg.Source)
	if err != nil {
		return err
	}
	G.Log.Debug("PGPEncrypt.Run: wrote %d bytes", n)
	return w.Close()
}

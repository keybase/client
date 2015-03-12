package engine

import (
	"fmt"
	"io"

	"github.com/keybase/client/go/libkb"
)

type PGPTrackEncryptArg struct {
	Recips []string // user assertions
	Source io.Reader
	Sink   io.Writer
	NoSign bool
	NoSelf bool
}

// PGPTrackEncrypt encrypts data read from a source into a sink
// for a set of users.  It will track them if necessary.
type PGPTrackEncrypt struct {
	arg *PGPTrackEncryptArg
	libkb.Contextified
}

// NewPGPTrackEncrypt creates a PGPTrackEncrypt engine.
func NewPGPTrackEncrypt(arg *PGPTrackEncryptArg) *PGPTrackEncrypt {
	return &PGPTrackEncrypt{arg: arg}
}

// Name is the unique engine name.
func (e *PGPTrackEncrypt) Name() string {
	return "PGPTrackEncrypt"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPTrackEncrypt) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (e *PGPTrackEncrypt) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPTrackEncrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewPGPEncrypt(nil),
		NewPGPKeyfinder(nil),
	}
}

// Run starts the engine.
func (e *PGPTrackEncrypt) Run(ctx *Context, args, reply interface{}) error {
	var mykey *libkb.PgpKeyBundle
	if !e.arg.NoSign || !e.arg.NoSelf {
		// XXX need to handle key arg (put it in KeyQuery)
		G.Log.Warning("key arg not handled yet")
		ska := libkb.SecretKeyArg{
			Reason:  "command-line signature",
			PGPOnly: true,
			Ui:      ctx.SecretUI,
		}
		key, err := e.G().Keyrings.GetSecretKey(ska)
		if err != nil {
			return err
		}
		if key == nil {
			return fmt.Errorf("No secret key available")
		}

		var ok bool
		mykey, ok = key.(*libkb.PgpKeyBundle)
		if !ok {
			return fmt.Errorf("Can only sign with PGP keys")
		}
	}

	kf := NewPGPKeyfinder(e.arg.Recips)
	if err := RunEngine(kf, ctx, nil, nil); err != nil {
		return err
	}
	uplus := kf.UsersPlusKeys()

	arg := &PGPEncryptArg{
		Source: e.arg.Source,
		Sink:   e.arg.Sink,
	}

	if !e.arg.NoSign {
		arg.Signer = mykey
	}

	if !e.arg.NoSelf {
		arg.Recipients = append(arg.Recipients, mykey)
	}

	for _, up := range uplus {
		arg.Recipients = append(arg.Recipients, up.Keys...)
	}
	encrypter := NewPGPEncrypt(arg)
	return RunEngine(encrypter, ctx, nil, nil)
}

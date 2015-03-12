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
		// need our own key
		me, err := libkb.LoadMe(libkb.LoadUserArg{})
		if err != nil {
			return err
		}
		keys := me.GetActivePgpKeys(true)
		if len(keys) == 0 {
			// XXX improve this
			return fmt.Errorf("need a key (self or sign is on)")
		}

		// XXX need to handle key arg
		G.Log.Warning("key arg not handled yet")
		mykey = keys[0]
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

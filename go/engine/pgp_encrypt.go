package engine

import (
	"errors"
	"io"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/openpgp/armor"
)

type PGPEncryptArg struct {
	Recips       []string // user assertions
	Source       io.Reader
	Sink         io.WriteCloser
	NoSign       bool
	NoSelf       bool
	BinaryOutput bool
	KeyQuery     string
	TrackOptions TrackOptions
}

// PGPEncrypt encrypts data read from a source into a sink
// for a set of users.  It will track them if necessary.
type PGPEncrypt struct {
	arg *PGPEncryptArg
	libkb.Contextified
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
	return EnginePrereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (e *PGPEncrypt) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPEncrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewPGPKeyfinder(nil),
	}
}

// Run starts the engine.
func (e *PGPEncrypt) Run(ctx *Context, args, reply interface{}) error {
	var mykey *libkb.PgpKeyBundle
	if !e.arg.NoSign || !e.arg.NoSelf {
		ska := libkb.SecretKeyArg{
			Reason:   "command-line signature",
			PGPOnly:  true,
			KeyQuery: e.arg.KeyQuery,
			Ui:       ctx.SecretUI,
		}
		key, err := e.G().Keyrings.GetSecretKey(ska)
		if err != nil {
			return err
		}
		if key == nil {
			return errors.New("No secret key available")
		}

		var ok bool
		mykey, ok = key.(*libkb.PgpKeyBundle)
		if !ok {
			return errors.New("Can only sign with PGP keys")
		}
	}

	kfarg := &PGPKeyfinderArg{
		Users:        e.arg.Recips,
		TrackOptions: e.arg.TrackOptions,
	}

	kf := NewPGPKeyfinder(kfarg)
	if err := RunEngine(kf, ctx, nil, nil); err != nil {
		return err
	}
	uplus := kf.UsersPlusKeys()

	var writer io.WriteCloser
	if e.arg.BinaryOutput {
		writer = e.arg.Sink
	} else {
		aw, err := armor.Encode(e.arg.Sink, "PGP MESSAGE", nil)
		if err != nil {
			return err
		}
		writer = aw
	}

	var signer *libkb.PgpKeyBundle
	if !e.arg.NoSign {
		signer = mykey
	}

	var recipients []*libkb.PgpKeyBundle
	if !e.arg.NoSelf {
		recipients = append(recipients, mykey)
	}

	for _, up := range uplus {
		recipients = append(recipients, up.Keys...)
	}

	//	encrypter := NewPGPEncrypt(arg)
	//	return RunEngine(encrypter, ctx, nil, nil)
	return libkb.PGPEncrypt(e.arg.Source, writer, signer, recipients)
}

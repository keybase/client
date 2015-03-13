package engine

import (
	"errors"
	"io"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/crypto/openpgp/armor"
)

type PGPTrackEncryptArg struct {
	Recips            []string // user assertions
	Source            io.Reader
	Sink              io.WriteCloser
	NoSign            bool
	NoSelf            bool
	BinaryOutput      bool
	KeyQuery          string
	TrackRemote       bool
	PromptTrackRemote bool
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
		Users:             e.arg.Recips,
		TrackRemote:       e.arg.TrackRemote,
		PromptTrackRemote: e.arg.PromptTrackRemote,
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

	arg := &PGPEncryptArg{
		Source: e.arg.Source,
		Sink:   writer,
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

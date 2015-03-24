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
	return EnginePrereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPEncrypt) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPEncrypt) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewPGPKeyfinder(nil),
	}
}

// Run starts the engine.
func (e *PGPEncrypt) Run(ctx *Context) error {
	// verify valid options based on logged in state:
	ok, err := G.Session.LoadAndCheck()
	if err != nil {
		return err
	}

	if !ok {
		// not logged in.  this is fine, unless they requested signing the message.
		if !e.arg.NoSign {
			return libkb.LoginRequiredError{Context: "you must be logged in to sign"}
		}

		// turn this on automatically when not logged in
		e.arg.NoSelf = true
	}

	var mykey *libkb.PgpKeyBundle
	var signer *libkb.PgpKeyBundle
	if !e.arg.NoSign {
		ska := libkb.SecretKeyArg{
			Reason:       "command-line signature",
			PGPOnly:      true,
			SyncedPGPKey: true,
			KeyQuery:     e.arg.KeyQuery,
			Ui:           ctx.SecretUI,
		}
		key, _, err := e.G().Keyrings.GetSecretKey(ska)
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
		signer = mykey
	}

	kfarg := &PGPKeyfinderArg{
		Users:        e.arg.Recips,
		TrackOptions: e.arg.TrackOptions,
	}

	kf := NewPGPKeyfinder(kfarg)
	if err := RunEngine(kf, ctx); err != nil {
		return err
	}
	uplus := kf.UsersPlusKeys()

	var writer io.WriteCloser
	if e.arg.BinaryOutput {
		writer = e.arg.Sink
	} else {
		// Fixme as per #48.
		aw, err := armor.Encode(e.arg.Sink, "PGP MESSAGE", nil)
		if err != nil {
			return err
		}
		writer = aw
	}

	var recipients []*libkb.PgpKeyBundle
	if !e.arg.NoSelf {
		if mykey == nil {
			// need to load the public key for the logged in user
			mykey, err = e.loadSelfKey()
			if err != nil {
				return err
			}
		}

		// mykey could still be nil
		if mykey != nil {
			recipients = append(recipients, mykey)
		}
	}

	for _, up := range uplus {
		recipients = append(recipients, up.Keys...)
	}

	return libkb.PGPEncrypt(e.arg.Source, writer, signer, recipients)
}

func (e *PGPEncrypt) loadSelfKey() (*libkb.PgpKeyBundle, error) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return nil, err
	}

	keys := me.FilterActivePgpKeys(true, e.arg.KeyQuery)
	if len(keys) == 0 {
		return nil, nil
	}
	return keys[0], nil
}

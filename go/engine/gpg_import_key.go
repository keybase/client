package engine

//
// engine.GPGImportKeyEngine is a class that selects key from the GPG keyring via
// shell-out to the gpg command line client. It's useful in `client mykey select`
// and other places in which the user picks existing PGP keys on the existing
// system for use in Keybase tasks.
//

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

type GPGImportKeyArg struct {
	Query      string
	Signer     libkb.GenericKey
	AllowMulti bool
	SkipImport bool
	Me         *libkb.User
	Lks        *libkb.LKSec
}

type GPGImportKeyEngine struct {
	last *libkb.PgpKeyBundle
	arg  *GPGImportKeyArg
	libkb.Contextified
}

func NewGPGImportKeyEngine(arg *GPGImportKeyArg, g *libkb.GlobalContext) *GPGImportKeyEngine {
	return &GPGImportKeyEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *GPGImportKeyEngine) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

func (e *GPGImportKeyEngine) Name() string {
	return "GPGImportKeyEngine"
}

func (e *GPGImportKeyEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.GPGUIKind,
		libkb.SecretUIKind,
	}
}

func (e *GPGImportKeyEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewPGPKeyImportEngine(PGPKeyImportEngineArg{}),
	}
}

func (e *GPGImportKeyEngine) WantsGPG(ctx *Context) (bool, error) {
	gpg := e.G().GetGpgClient()
	canExec, err := gpg.CanExec()
	if err != nil {
		return false, err
	}
	if !canExec {
		return false, nil
	}

	// they have gpg

	res, err := ctx.GPGUI.WantToAddGPGKey(0)
	if err != nil {
		return false, err
	}
	return res, nil
}

func (e *GPGImportKeyEngine) Run(ctx *Context) (err error) {
	gpg := e.G().GetGpgClient()

	me := e.arg.Me
	if me != nil {
	} else if me, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true}); err != nil {
		return err
	}

	if err = PGPCheckMulti(me, e.arg.AllowMulti); err != nil {
		return err
	}

	if _, err = gpg.Configure(); err != nil {
		return err
	}
	index, warns, err := gpg.Index(true, e.arg.Query)
	if err != nil {
		return err
	}
	warns.Warn()

	var gks []keybase1.GPGKey
	for _, key := range index.Keys {
		gk := keybase1.GPGKey{
			Algorithm:  fmt.Sprintf("%d%s", key.Bits, key.AlgoString()),
			KeyID:      key.GetFingerprint().ToKeyID(),
			Expiration: key.ExpirationString(),
			Identities: key.GetPgpIdentities(),
		}
		gks = append(gks, gk)
	}

	if len(gks) == 0 {
		return fmt.Errorf("No PGP keys available to choose from.")
	}

	res, err := ctx.GPGUI.SelectKeyAndPushOption(keybase1.SelectKeyAndPushOptionArg{Keys: gks})
	if err != nil {
		return err
	}
	e.G().Log.Info("SelectKey result: %+v", res)

	var selected *libkb.GpgPrimaryKey
	for _, key := range index.Keys {
		if key.GetFingerprint().ToKeyID() == res.KeyID {
			selected = key
			break
		}
	}

	if selected == nil {
		return nil
	}

	bundle, err := gpg.ImportKey(true, *(selected.GetFingerprint()))
	if err != nil {
		return fmt.Errorf("ImportKey error: %s", err)
	}

	if err := bundle.Unlock("Import of key into keybase keyring", ctx.SecretUI); err != nil {
		return err
	}

	e.G().Log.Info("Bundle unlocked: %s", selected.GetFingerprint().ToKeyID())

	eng := NewPGPKeyImportEngine(PGPKeyImportEngineArg{
		Pregen:     bundle,
		SigningKey: e.arg.Signer,
		Me:         me,
		AllowMulti: e.arg.AllowMulti,
		NoSave:     e.arg.SkipImport,
		Lks:        e.arg.Lks,
	})

	if err = RunEngine(eng, ctx); err != nil {

		// It's important to propogate a CanceledError unmolested,
		// since the UI needs to know that. See:
		//  https://github.com/keybase/client/issues/226
		if _, ok := err.(libkb.CanceledError); !ok {
			err = libkb.KeyGenError{Msg: err.Error()}
		}
		return
	}

	e.G().Log.Info("Key %s imported", selected.GetFingerprint().ToKeyID())

	e.last = bundle

	return nil
}

func (e *GPGImportKeyEngine) LastKey() *libkb.PgpKeyBundle {
	return e.last
}

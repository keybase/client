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
	keybase_1 "github.com/keybase/client/protocol/go"
)

type GPGImportKeyArg struct {
	Query      string
	Signer     libkb.GenericKey
	AllowMulti bool
	SkipImport bool
	Me         *libkb.User
}

type GPGImportKeyEngine struct {
	last *libkb.PgpKeyBundle
	arg  *GPGImportKeyArg
}

func NewGPGImportKeyEngine(arg *GPGImportKeyArg) *GPGImportKeyEngine {
	return &GPGImportKeyEngine{arg: arg}
}

func (e *GPGImportKeyEngine) GetPrereqs() EnginePrereqs {
	return EnginePrereqs{
		Session: true,
	}
}

func (g *GPGImportKeyEngine) Name() string {
	return "GPGImportKeyEngine"
}

func (g *GPGImportKeyEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.GPGUIKind,
		libkb.SecretUIKind,
	}
}

func (g *GPGImportKeyEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		NewPGPKeyImportEngine(PGPKeyImportEngineArg{}),
	}
}

func (g *GPGImportKeyEngine) WantsGPG(ctx *Context) (bool, error) {
	gpg := G.GetGpgClient()
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

func (g *GPGImportKeyEngine) Run(ctx *Context) (err error) {

	gpg := G.GetGpgClient()

	me := g.arg.Me
	if me != nil {
	} else if me, err = libkb.LoadMe(libkb.LoadUserArg{PublicKeyOptional: true}); err != nil {
		return err
	}

	if err = PGPCheckMulti(me, g.arg.AllowMulti); err != nil {
		return err
	}

	if _, err = gpg.Configure(); err != nil {
		return err
	}
	index, err, warns := gpg.Index(true, g.arg.Query)
	if err != nil {
		return err
	}
	warns.Warn()

	var gks []keybase_1.GPGKey
	for _, key := range index.Keys {
		gk := keybase_1.GPGKey{
			Algorithm:  fmt.Sprintf("%d%s", key.Bits, key.AlgoString()),
			KeyID:      key.GetFingerprint().ToKeyId(),
			Expiration: key.ExpirationString(),
			Identities: key.GetEmails(),
		}
		gks = append(gks, gk)
	}

	if len(gks) == 0 {
		return fmt.Errorf("No PGP keys available to choose from.")
	}

	res, err := ctx.GPGUI.SelectKeyAndPushOption(keybase_1.SelectKeyAndPushOptionArg{Keys: gks})
	if err != nil {
		return err
	}
	G.Log.Info("SelectKey result: %+v", res)

	var selected *libkb.GpgPrimaryKey
	for _, key := range index.Keys {
		if key.GetFingerprint().ToKeyId() == res.KeyID {
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

	G.Log.Info("Bundle unlocked: %s", selected.GetFingerprint().ToKeyId())

	eng := NewPGPKeyImportEngine(PGPKeyImportEngineArg{
		Pregen:     bundle,
		SigningKey: g.arg.Signer,
		Me:         me,
		AllowMulti: g.arg.AllowMulti,
		NoSave:     g.arg.SkipImport,
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

	G.Log.Info("Key %s imported", selected.GetFingerprint().ToKeyId())

	g.last = bundle

	return nil
}

func (g *GPGImportKeyEngine) LastKey() *libkb.PgpKeyBundle {
	return g.last
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

//
// engine.GPGImportKeyEngine is a class that selects key from the GPG keyring via
// shell-out to the gpg command line client. It's useful in `client mykey select`
// and other places in which the user picks existing PGP keys on the existing
// system for use in Keybase tasks.
//

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type GPGImportKeyArg struct {
	Query      string
	Signer     libkb.GenericKey
	AllowMulti bool
	SkipImport bool
	OnlyImport bool
	Me         *libkb.User
	Lks        *libkb.LKSec
}

type GPGImportKeyEngine struct {
	last                   *libkb.PGPKeyBundle
	arg                    *GPGImportKeyArg
	duplicatedFingerprints []libkb.PGPFingerprint
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
		&PGPKeyImportEngine{},
		&PGPUpdateEngine{},
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

	// get an index of all the secret keys
	index, _, err := gpg.Index(true, "")
	if err != nil {
		return false, err
	}
	if index.Len() == 0 {
		// no private keys available, so don't offer
		return false, nil
	}

	res, err := ctx.GPGUI.WantToAddGPGKey(context.TODO(), 0)
	if err != nil {
		return false, err
	}
	return res, nil
}

func (e *GPGImportKeyEngine) Run(ctx *Context) (err error) {
	gpg := e.G().GetGpgClient()

	me := e.arg.Me
	if me == nil {
		if me, err = libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(e.G())); err != nil {
			return err
		}
	}

	if !e.arg.OnlyImport {
		if err = PGPCheckMulti(me, e.arg.AllowMulti); err != nil {
			return err
		}
	}

	if err = gpg.Configure(); err != nil {
		return err
	}
	index, warns, err := gpg.Index(true, e.arg.Query)
	if err != nil {
		return err
	}
	warns.Warn(e.G())

	var gks []keybase1.GPGKey
	for _, key := range index.Keys {
		gk := keybase1.GPGKey{
			Algorithm:  fmt.Sprintf("%d%s", key.Bits, key.AlgoString()),
			KeyID:      key.GetFingerprint().ToKeyID(),
			Expiration: key.ExpirationString(),
			Identities: key.GetPGPIdentities(),
		}
		gks = append(gks, gk)
	}

	if len(gks) == 0 {
		return fmt.Errorf("No PGP keys available to choose from.")
	}

	res, err := ctx.GPGUI.SelectKeyAndPushOption(context.TODO(), keybase1.SelectKeyAndPushOptionArg{Keys: gks})
	if err != nil {
		return err
	}
	e.G().Log.Debug("SelectKey result: %+v", res)

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

	publicKeys := me.GetActivePGPKeys(false)
	duplicate := false
	for _, key := range publicKeys {
		if key.GetFingerprint().Eq(*(selected.GetFingerprint())) {
			duplicate = true
			break
		}
	}
	if duplicate && !e.arg.OnlyImport {
		// This key's already been posted to the server.
		res, err := ctx.GPGUI.ConfirmDuplicateKeyChosen(context.TODO(), 0)
		if err != nil {
			return err
		}
		if !res {
			return libkb.SibkeyAlreadyExistsError{}
		}
		// We're sending a key update, then.
		fp := fmt.Sprintf("%s", *(selected.GetFingerprint()))
		eng := NewPGPUpdateEngine([]string{fp}, false, e.G())
		err = RunEngine(eng, ctx)
		e.duplicatedFingerprints = eng.duplicatedFingerprints

		return err
	}

	tty, err := ctx.GPGUI.GetTTY(ctx.NetContext)
	if err != nil {
		e.G().Log.Warning("error getting TTY for GPG: %s", err)
		err = nil
	}

	var bundle *libkb.PGPKeyBundle

	if e.arg.SkipImport {
		// If we don't need secret key to save in Keybase keyring,
		// just import public key and rely on GPG fallback for reverse
		// signature.
		bundle, err = gpg.ImportKey(false, *(selected.GetFingerprint()), tty)
		if err != nil {
			return fmt.Errorf("ImportKey (secret: false) error: %s", err)
		}
	} else {
		bundle, err = gpg.ImportKey(true, *(selected.GetFingerprint()), tty)
		if err != nil {
			return fmt.Errorf("ImportKey (secret: true) error: %s", err)
		}

		if err := bundle.Unlock(e.G(), "Import of key into Keybase keyring", ctx.SecretUI); err != nil {
			return err
		}
	}

	e.G().Log.Info("Bundle unlocked: %s", selected.GetFingerprint().ToKeyID())

	eng := NewPGPKeyImportEngine(PGPKeyImportEngineArg{
		Pregen:      bundle,
		SigningKey:  e.arg.Signer,
		Me:          me,
		AllowMulti:  e.arg.AllowMulti,
		NoSave:      e.arg.SkipImport,
		OnlySave:    e.arg.OnlyImport,
		Lks:         e.arg.Lks,
		GPGFallback: true,
	})

	if err = RunEngine(eng, ctx); err != nil {

		// It's important to propagate a CanceledError unmolested,
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

func (e *GPGImportKeyEngine) LastKey() *libkb.PGPKeyBundle {
	return e.last
}

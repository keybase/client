// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

//
// engine.PGPKeyImportEngine is a class for optionally generating PGP keys,
// and pushing them into the keybase sigchain via the Delegator.
//

import (
	"errors"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type PGPKeyImportEngine struct {
	me     *libkb.User
	bundle *libkb.PGPKeyBundle
	arg    PGPKeyImportEngineArg
	epk    string
	del    *libkb.Delegator
	libkb.Contextified
}

type PGPKeyImportEngineArg struct {
	Gen              *libkb.PGPGenArg
	Pregen           *libkb.PGPKeyBundle
	SigningKey       libkb.GenericKey
	Me               *libkb.User
	Ctx              *libkb.GlobalContext
	Lks              *libkb.LKSec
	NoSave           bool
	PushSecret       bool
	OnlySave         bool
	AllowMulti       bool
	DoExport         bool
	DoUnlock         bool
	GPGFallback      bool
	PreloadTsec      libkb.Triplesec
	PreloadStreamGen libkb.PassphraseGeneration
}

func NewPGPKeyImportEngineFromBytes(key []byte, pushPrivate bool, gc *libkb.GlobalContext) (eng *PGPKeyImportEngine, err error) {
	var bundle *libkb.PGPKeyBundle
	var w *libkb.Warnings
	if libkb.IsArmored(key) {
		bundle, w, err = libkb.ReadPrivateKeyFromString(string(key))
	} else {
		bundle, w, err = libkb.ReadOneKeyFromBytes(key)
	}
	if err != nil {
		return
	}
	w.Warn(gc)
	arg := PGPKeyImportEngineArg{
		Pregen:     bundle,
		PushSecret: pushPrivate,
		AllowMulti: true,
		DoExport:   false,
		DoUnlock:   true,
		Ctx:        gc,
	}
	eng = NewPGPKeyImportEngine(arg)
	return
}

func (e *PGPKeyImportEngine) loadMe() (err error) {
	if e.me = e.arg.Me; e.me != nil {
		return
	}
	e.me, err = libkb.LoadMe(libkb.NewLoadUserPubOptionalArg(e.G()))
	return err
}

func (e *PGPKeyImportEngine) loadLoginSession(ctx *Context) error {
	var err error
	if ctx.LoginContext != nil {
		err = ctx.LoginContext.LoadLoginSession(e.me.GetName())
	} else {
		aerr := e.G().LoginState().Account(func(a *libkb.Account) {
			err = a.LoadLoginSession(e.me.GetName())
		}, "PGPKeyImportEngine - loadLoginSession")
		if aerr != nil {
			return aerr
		}
	}
	return err
}

func (e *PGPKeyImportEngine) generateKey(ctx *Context) (err error) {
	gen := e.arg.Gen
	if err = gen.CreatePGPIDs(); err != nil {
		return
	}
	e.bundle, err = libkb.GeneratePGPKeyBundle(e.G(), *gen, ctx.LogUI)
	return
}

func (e *PGPKeyImportEngine) saveLKS(ctx *Context) (err error) {
	e.G().Log.Debug("+ PGPKeyImportEngine::saveLKS")
	defer func() {
		e.G().Log.Debug("- PGPKeyImportEngine::saveLKS -> %v", libkb.ErrToOk(err))
	}()

	lks := e.arg.Lks
	if lks == nil {
		lks, err = libkb.NewLKSecForEncrypt(ctx.SecretUI, e.me.GetUID(), e.G())
		if err != nil {
			return err
		}
	}
	_, err = libkb.WriteLksSKBToKeyring(e.G(), e.bundle, lks, ctx.LoginContext)
	return
}

var ErrKeyGenArgNoDefNoCustom = errors.New("invalid args:  NoDefPGPUid set, but no custom PGPUids")

func NewPGPKeyImportEngine(arg PGPKeyImportEngineArg) *PGPKeyImportEngine {
	return &PGPKeyImportEngine{arg: arg, Contextified: libkb.NewContextified(arg.Ctx)}
}

func (e *PGPKeyImportEngine) Name() string {
	return "PGPKeyImportEngine"
}

func (e *PGPKeyImportEngine) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

func (e *PGPKeyImportEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *PGPKeyImportEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *PGPKeyImportEngine) init() (err error) {
	if e.arg.Gen != nil {
		err = e.arg.Gen.Init()
	}
	return err
}

func (e *PGPKeyImportEngine) testExisting() (err error) {
	return PGPCheckMulti(e.me, e.arg.AllowMulti)
}

// checkPregenPrivate makes sure that the pregenerated key is a
// private key.
func (e *PGPKeyImportEngine) checkPregenPrivate() error {
	if e.arg.Pregen == nil {
		return nil
	}
	if e.arg.Pregen.HasSecretKey() || e.arg.GPGFallback {
		return nil
	}
	return libkb.NoSecretKeyError{}
}

func (e *PGPKeyImportEngine) Run(ctx *Context) error {
	e.G().Log.Debug("+ PGPKeyImportEngine::Run")
	defer func() {
		e.G().Log.Debug("- PGPKeyImportEngine::Run")
	}()

	if err := e.init(); err != nil {
		return err
	}

	if err := e.loadMe(); err != nil {
		return err
	}

	if err := e.loadLoginSession(ctx); err != nil {
		return err
	}

	if err := e.checkPregenPrivate(); err != nil {
		return err
	}

	if !e.arg.OnlySave {
		if err := e.testExisting(); err != nil {
			return err
		}

		if err := e.loadDelegator(ctx); err != nil {
			return err
		}
	}

	if err := e.unlock(ctx); err != nil {
		return err
	}

	if err := e.generate(ctx); err != nil {
		return err
	}

	if !e.arg.OnlySave {
		if err := e.push(ctx); err != nil {
			return err
		}

		if err := e.exportToGPG(ctx); err != nil {
			return err
		}
	}

	return nil
}

func (e *PGPKeyImportEngine) exportToGPG(ctx *Context) (err error) {
	if !e.arg.DoExport || e.arg.Pregen != nil {
		e.G().Log.Debug("| Skipping export to GPG")
		return
	}
	gpg := e.G().GetGpgClient()

	ok, err := gpg.CanExec()
	if err != nil {
		e.G().Log.Debug("Not saving new key to GPG. Error in gpg.CanExec(): %s", err)
		// libkb/util_*.go:canExec() can return generic errors, just ignore them
		// in this situation since export to gpg is on by default in the client
		// pgp gen command.
		return nil
	}
	if !ok {
		e.G().Log.Debug("Not saving new key to GPG since no gpg install was found")
		return nil
	}

	err = gpg.ExportKey(*e.bundle, true /* export private key */)
	if err == nil {
		ctx.LogUI.Info("Exported new key to the local GPG keychain")
	}
	return err
}

func (e *PGPKeyImportEngine) unlock(ctx *Context) (err error) {
	e.G().Log.Debug("+ PGPKeyImportEngine::unlock")
	defer func() {
		e.G().Log.Debug("- PGPKeyImportEngine::unlock -> %s", libkb.ErrToOk(err))
	}()
	if e.arg.Pregen == nil || !e.arg.DoUnlock || !e.arg.Pregen.HasSecretKey() {
		e.G().Log.Debug("| short circuit unlock function")
	} else {
		err = e.arg.Pregen.Unlock(e.G(), "import into private keychain", ctx.SecretUI)
	}
	return

}

func (e *PGPKeyImportEngine) loadDelegator(ctx *Context) (err error) {

	e.del = &libkb.Delegator{
		ExistingKey:    e.arg.SigningKey,
		Me:             e.me,
		Expire:         libkb.KeyExpireIn,
		DelegationType: libkb.DelegationTypeSibkey,
		Contextified:   libkb.NewContextified(e.G()),
	}

	return e.del.LoadSigningKey(ctx.LoginContext, ctx.SecretUI)
}

func (e *PGPKeyImportEngine) generate(ctx *Context) (err error) {

	e.G().Log.Debug("+ PGP::Generate")
	defer func() {
		e.G().Log.Debug("- PGP::Generate -> %s", libkb.ErrToOk(err))
	}()

	e.G().Log.Debug("| GenerateKey")
	if e.arg.Pregen != nil {
		e.bundle = e.arg.Pregen
	} else if e.arg.Gen == nil {
		err = libkb.InternalError{Msg: "PGPKeyImportEngine: need either Gen or Pregen"}
		return
	} else if err = e.generateKey(ctx); err != nil {
		return
	}

	e.G().Log.Debug("| WriteKey (hasSecret = %v)", e.bundle.HasSecretKey())
	if !e.arg.NoSave && e.bundle.HasSecretKey() {
		if err = e.saveLKS(ctx); err != nil {
			return
		}
	}

	if e.arg.PushSecret {
		if err = e.prepareSecretPush(ctx); err != nil {
			return
		}
	}
	return

}

func (e *PGPKeyImportEngine) prepareSecretPush(ctx *Context) error {
	var tsec libkb.Triplesec
	var gen libkb.PassphraseGeneration
	if e.arg.PreloadTsec != nil && e.arg.PreloadStreamGen > 0 {
		tsec = e.arg.PreloadTsec
		gen = e.arg.PreloadStreamGen
	} else {
		var err error
		tsec, gen, err = e.G().LoginState().GetVerifiedTriplesec(ctx.SecretUI)
		if err != nil {
			return err
		}
	}

	skb, err := e.bundle.ToServerSKB(e.G(), tsec, gen)
	if err != nil {
		return err
	}
	e.epk, err = skb.ArmoredEncode()

	return err
}

func (e *PGPKeyImportEngine) push(ctx *Context) (err error) {
	e.G().Log.Debug("+ PGP::Push")
	if e.arg.GPGFallback {
		e.bundle.GPGFallbackKey = libkb.NewGPGKey(
			e.G(),
			e.bundle.GetFingerprintP(),
			e.bundle.GetKID(),
			ctx.GPGUI,
			ctx.ClientType)
	}
	e.del.NewKey = e.bundle
	e.del.EncodedPrivateKey = e.epk
	if err = e.del.Run(ctx.LoginContext); err != nil {
		return err
	}
	e.G().Log.Debug("- PGP::Push -> %s", libkb.ErrToOk(err))

	ctx.LogUI.Info("Generated new PGP key:")
	d := e.bundle.VerboseDescription()
	for _, line := range strings.Split(d, "\n") {
		ctx.LogUI.Info("  %s", line)
	}

	return nil
}

func PGPCheckMulti(me *libkb.User, allowMulti bool) (err error) {
	if allowMulti {
		return
	}
	if pgps := me.GetActivePGPKeys(false); len(pgps) > 0 {
		err = libkb.KeyExistsError{Key: pgps[0].GetFingerprintP()}
	}
	return
}

func (e *PGPKeyImportEngine) GetKID() (kid keybase1.KID) {
	if e.bundle == nil {
		return kid
	}
	return e.bundle.GetKID()
}

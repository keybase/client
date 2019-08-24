// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

//
// engine.PGPKeyImportEngine is a class for optionally generating PGP keys,
// and pushing them into the keybase sigchain via the Delegator.
//

import (
	"bytes"
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
	Lks              *libkb.LKSec
	NoSave           bool
	PushSecret       bool
	OnlySave         bool
	AllowMulti       bool
	DoExport         bool // export to GPG keychain?
	ExportEncrypted  bool // encrypt secret key before exporting to GPG?
	DoUnlock         bool
	GPGFallback      bool
	PreloadTsec      libkb.Triplesec
	PreloadStreamGen libkb.PassphraseGeneration
}

func NewPGPKeyImportEngineFromBytes(g *libkb.GlobalContext, key []byte, pushPrivate bool) (eng *PGPKeyImportEngine, err error) {
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
	w.Warn(g)
	arg := PGPKeyImportEngineArg{
		Pregen:     bundle,
		PushSecret: pushPrivate,
		AllowMulti: true,
		DoExport:   false,
		DoUnlock:   true,
	}
	eng = NewPGPKeyImportEngine(g, arg)
	return
}

func (e *PGPKeyImportEngine) loadMe(m libkb.MetaContext) (err error) {
	if e.me = e.arg.Me; e.me != nil {
		return
	}
	e.me, err = libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m).WithPublicKeyOptional())
	return err
}

func (e *PGPKeyImportEngine) generateKey(m libkb.MetaContext) (err error) {
	gen := e.arg.Gen
	if err = gen.CreatePGPIDs(); err != nil {
		return
	}
	e.bundle, err = libkb.GeneratePGPKeyBundle(m.G(), *gen, m.UIs().LogUI)
	return
}

func (e *PGPKeyImportEngine) saveLKS(m libkb.MetaContext) (err error) {

	defer m.Trace("PGPKeyImportEngine::saveLKS", func() error { return err })()

	lks := e.arg.Lks
	if lks == nil {
		lks, err = libkb.NewLKSecForEncrypt(m, m.UIs().SecretUI, e.me.GetUID())
		if err != nil {
			return err
		}
	}
	_, err = libkb.WriteLksSKBToKeyring(m, e.bundle, lks)
	return
}

var ErrKeyGenArgNoDefNoCustom = errors.New("invalid args:  NoDefPGPUid set, but no custom PGPUids")

func NewPGPKeyImportEngine(g *libkb.GlobalContext, arg PGPKeyImportEngineArg) *PGPKeyImportEngine {
	return &PGPKeyImportEngine{arg: arg, Contextified: libkb.NewContextified(g)}
}

func (e *PGPKeyImportEngine) Name() string {
	return "PGPKeyImportEngine"
}

func (e *PGPKeyImportEngine) Prereqs() Prereqs {
	return Prereqs{}
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

func (e *PGPKeyImportEngine) checkExistingKey(m libkb.MetaContext) error {
	// Check if we have a public key that matches
	pgps := e.me.GetActivePGPKeys(false)
	for _, key := range pgps {
		if e.GetKID() != key.GetKID() {
			continue
		}

		e.G().Log.Info("Key %s already exists. Only importing the private key.", e.GetKID())
		e.arg.OnlySave = true
		break
	}

	return nil
}

func (e *PGPKeyImportEngine) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("PGPKeyImportEngine::Run", func() error { return err })()

	if err = e.init(); err != nil {
		return err
	}

	if err = e.loadMe(m); err != nil {
		switch err.(type) {
		case libkb.SelfNotFoundError:
			err = libkb.LoginRequiredError{}
		}
		return err
	}

	if e.arg.PushSecret {
		if err = e.checkRandomPassword(m); err != nil {
			return err
		}
	}

	if err = e.checkPregenPrivate(); err != nil {
		return err
	}

	if !e.arg.OnlySave {
		if err = e.testExisting(); err != nil {
			return err
		}

		if err = e.loadDelegator(m); err != nil {
			switch err.(type) {
			case libkb.NoUsernameError:
				err = libkb.LoginRequiredError{}
			}
			return err
		}
	}

	if err = e.generate(m); err != nil {
		return err
	}

	if err = e.unlock(m); err != nil {
		return err
	}

	if err := e.checkExistingKey(m); err != nil {
		return err
	}

	if err = e.saveKey(m); err != nil {
		return err
	}

	if !e.arg.OnlySave {
		if err = e.push(m); err != nil {
			return err
		}
		if err = e.exportToGPG(m); err != nil {
			return GPGExportingError{err, true /* inPGPGen */}
		}
	} else if e.arg.PushSecret {
		if err = e.pushSecretOnly(m); err != nil {
			return err
		}
	}

	return nil
}

func (e *PGPKeyImportEngine) checkRandomPassword(mctx libkb.MetaContext) error {
	random, err := libkb.LoadHasRandomPw(mctx, keybase1.LoadHasRandomPwArg{})
	if err != nil {
		return err
	}
	if random {
		return libkb.NewPushSecretWithoutPasswordError("You need to set your password first before uploading secret keys")
	}
	return nil
}

// clonePGPKeyBundle returns an approximate deep copy of PGPKeyBundle
// by exporting and re-importing PGPKeyBundle. If PGP key contains
// something that is not supported by either go-crypto exporter or
// importer, that information will be lost.
func clonePGPKeyBundle(bundle *libkb.PGPKeyBundle) (*libkb.PGPKeyBundle, error) {
	var buf bytes.Buffer
	if err := bundle.SerializePrivate(&buf); err != nil {
		return nil, err
	}
	res, _, err := libkb.ReadOneKeyFromBytes(buf.Bytes())
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (e *PGPKeyImportEngine) exportToGPG(m libkb.MetaContext) (err error) {
	if !e.arg.DoExport || e.arg.Pregen != nil {
		m.Debug("| Skipping export to GPG")
		return nil
	}
	gpg := e.G().GetGpgClient()

	ok, err := gpg.CanExec()
	if err != nil {
		m.Debug("Not saving new key to GPG. Error in gpg.CanExec(): %s", err)
		// libkb/util_*.go:canExec() can return generic errors, just ignore them
		// in this situation since export to gpg is on by default in the client
		// pgp gen command.
		return nil
	}
	if !ok {
		m.Debug("Not saving new key to GPG since no gpg install was found")
		return nil
	}

	exportedBundle := e.bundle

	if e.arg.ExportEncrypted {
		m.Debug("Encrypting key with passphrase before exporting")
		desc := "Exporting key to GPG keychain. Enter passphrase to protect the key. Secure passphrases have at least 8 characters."
		pRes, err := GetPGPExportPassphrase(m, m.UIs().SecretUI, desc)
		if err != nil {
			return err
		}
		// Avoid mutating e.bundle.
		if exportedBundle, err = clonePGPKeyBundle(e.bundle); err != nil {
			return err
		}
		if err = libkb.EncryptPGPKey(exportedBundle.Entity, pRes.Passphrase); err != nil {
			return err
		}
	}

	// If key is encrypted, use batch mode in gpg so it does not ask
	// for passphrase to re-encrypt to its internal representation.
	err = gpg.ExportKey(*exportedBundle, true /* private */, e.arg.ExportEncrypted /* batch */)
	if err == nil {
		m.UIs().LogUI.Info("Exported new key to the local GPG keychain")
	}
	return err
}

func (e *PGPKeyImportEngine) unlock(m libkb.MetaContext) (err error) {
	defer m.Trace("PGPKeyImportEngine::unlock", func() error { return err })()
	if e.arg.Pregen == nil || !e.arg.DoUnlock || !e.arg.Pregen.HasSecretKey() {
		m.Debug("| short circuit unlock function")
	} else {
		err = e.arg.Pregen.Unlock(m, "import into private keychain", m.UIs().SecretUI)
	}
	return err
}

func (e *PGPKeyImportEngine) loadDelegator(m libkb.MetaContext) (err error) {

	e.del = &libkb.Delegator{
		ExistingKey:    e.arg.SigningKey,
		Me:             e.me,
		Expire:         libkb.KeyExpireIn,
		DelegationType: libkb.DelegationTypeSibkey,
		Contextified:   libkb.NewContextified(e.G()),
	}

	return e.del.LoadSigningKey(m, m.UIs().SecretUI)
}

func (e *PGPKeyImportEngine) generate(m libkb.MetaContext) (err error) {
	defer m.Trace("PGP::Generate", func() error { return err })()

	m.Debug("| GenerateKey")
	if e.arg.Pregen != nil {
		e.bundle = e.arg.Pregen
	} else if e.arg.Gen == nil {
		err = libkb.InternalError{Msg: "PGPKeyImportEngine: need either Gen or Pregen"}
		return
	} else if err = e.generateKey(m); err != nil {
		return
	}
	return
}

func (e *PGPKeyImportEngine) saveKey(m libkb.MetaContext) (err error) {
	defer m.Trace("PGP::saveKey", func() error { return err })()

	m.Debug("| WriteKey (hasSecret = %v)", e.bundle.HasSecretKey())
	if !e.arg.NoSave && e.bundle.HasSecretKey() {
		if err = e.saveLKS(m); err != nil {
			return
		}
	}

	if e.arg.PushSecret {
		if err = e.prepareSecretPush(m); err != nil {
			return
		}
	}
	return
}

func (e *PGPKeyImportEngine) prepareSecretPush(m libkb.MetaContext) error {
	var tsec libkb.Triplesec
	var gen libkb.PassphraseGeneration
	if e.arg.PreloadTsec != nil && e.arg.PreloadStreamGen > 0 {
		tsec = e.arg.PreloadTsec
		gen = e.arg.PreloadStreamGen
	} else {
		var err error
		tsec, gen, err = libkb.GetTriplesecMaybePrompt(m)
		if err != nil {
			return err
		}
	}

	skb, err := e.bundle.ToServerSKB(m.G(), tsec, gen)
	if err != nil {
		return err
	}
	e.epk, err = skb.ArmoredEncode()

	return err
}

func (e *PGPKeyImportEngine) push(m libkb.MetaContext) (err error) {
	defer m.Trace("PGP#Push", func() error { return err })()
	if e.arg.GPGFallback {
		e.bundle.GPGFallbackKey = libkb.NewGPGKey(
			m.G(),
			e.bundle.GetFingerprintP(),
			e.bundle.GetKID(),
			m.UIs().GPGUI,
			m.UIs().ClientType)
	}
	e.del.NewKey = e.bundle
	e.del.EncodedPrivateKey = e.epk
	if err = e.del.Run(m); err != nil {
		return err
	}

	m.UIs().LogUI.Info("Generated new PGP key:")
	d := e.bundle.VerboseDescription()
	for _, line := range strings.Split(d, "\n") {
		m.UIs().LogUI.Info("  %s", line)
	}

	return nil
}

func (e *PGPKeyImportEngine) pushSecretOnly(m libkb.MetaContext) (err error) {
	defer m.Trace("PGP#PushSecretOnly", func() error { return err })()

	m.UIs().LogUI.Info("Only pushing encrypted private key to Keybase server")

	hargs := libkb.HTTPArgs{
		"private_key": libkb.S{Val: e.epk},
	}
	arg := libkb.APIArg{
		Endpoint:    "key/add",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        hargs,
	}
	_, err = m.G().API.Post(m, arg)
	if err != nil {
		return err
	}

	m.UIs().LogUI.Info("Success! Pushed encrypted private key")
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

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"bytes"
	"errors"
	"fmt"

	"github.com/keybase/go-crypto/ed25519"
	"golang.org/x/crypto/nacl/box"
	"golang.org/x/crypto/scrypt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type PaperKeyGenArg struct {
	Passphrase    libkb.PaperKeyPhrase
	SkipPush      bool
	Me            *libkb.User
	SigningKey    libkb.GenericKey
	EncryptionKey libkb.NaclDHKeyPair

	LoginContext    libkb.LoginContext     // optional
	SharedDHKeyring *libkb.SharedDHKeyring // optional
}

// PaperKeyGen is an engine.
type PaperKeyGen struct {
	arg *PaperKeyGenArg

	// keys of the generated paper key
	sigKey libkb.GenericKey
	encKey libkb.NaclDHKeyPair

	libkb.Contextified
}

// NewPaperKeyGen creates a PaperKeyGen engine.
func NewPaperKeyGen(arg *PaperKeyGenArg, g *libkb.GlobalContext) *PaperKeyGen {
	return &PaperKeyGen{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PaperKeyGen) Name() string {
	return "PaperKeyGen"
}

// GetPrereqs returns the engine prereqs.
func (e *PaperKeyGen) Prereqs() Prereqs {
	// only need session if pushing keys
	return Prereqs{
		Session: !e.arg.SkipPush,
	}
}

// RequiredUIs returns the required UIs.
func (e *PaperKeyGen) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PaperKeyGen) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *PaperKeyGen) SigKey() libkb.GenericKey {
	return e.sigKey
}

func (e *PaperKeyGen) EncKey() libkb.NaclDHKeyPair {
	return e.encKey
}

// Run starts the engine.
func (e *PaperKeyGen) Run(ctx *Context) error {
	if e.G().Env.GetEnableSharedDH() && !e.arg.SkipPush {
		err := e.syncSDH(ctx)
		if err != nil {
			return err
		}
	}

	// make the passphrase stream
	key, err := scrypt.Key(e.arg.Passphrase.Bytes(), nil,
		libkb.PaperKeyScryptCost, libkb.PaperKeyScryptR, libkb.PaperKeyScryptP, libkb.PaperKeyScryptKeylen)
	if err != nil {
		return err
	}

	ppStream := libkb.NewPassphraseStream(key)

	// make keys for the paper device
	if err := e.makeSigKey(ppStream.EdDSASeed()); err != nil {
		return err
	}
	if err := e.makeEncKey(ppStream.DHSeed()); err != nil {
		return err
	}

	// push everything to the server
	if err := e.push(ctx); err != nil {
		return err
	}

	// no need to notify if key wasn't pushed to server
	// (e.g. in the case of using this engine to verify a key)
	if e.arg.SkipPush {
		return nil
	}

	e.G().KeyfamilyChanged(e.arg.Me.GetUID())

	return nil
}

func (e *PaperKeyGen) syncSDH(ctx *Context) error {
	// Sync the sdh keyring before updating other things.
	sdhk, err := e.getSharedDHKeyring()
	if err != nil {
		return err
	}
	var upak *keybase1.UserPlusAllKeys
	if e.arg.Me != nil {
		tmp := e.arg.Me.ExportToUserPlusAllKeys(keybase1.Time(0))
		upak = &tmp
	}
	err = sdhk.SyncWithExtras(ctx.NetContext, e.arg.LoginContext, upak)
	if err != nil {
		return err
	}
	// TODO if SDH_UPGRADE: may want to add a key here.
	return nil
}

func (e *PaperKeyGen) makeSigKey(seed []byte) error {
	pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(seed))
	if err != nil {
		return err
	}

	var key libkb.NaclSigningKeyPair
	copy(key.Public[:], pub[:])
	key.Private = &libkb.NaclSigningKeyPrivate{}
	copy(key.Private[:], priv[:])

	e.sigKey = key

	return nil
}

func (e *PaperKeyGen) makeEncKey(seed []byte) error {
	pub, priv, err := box.GenerateKey(bytes.NewBuffer(seed))
	if err != nil {
		return err
	}
	var key libkb.NaclDHKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &libkb.NaclDHKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	e.encKey = key

	return nil
}

func (e *PaperKeyGen) getClientHalfFromSecretStore() (libkb.LKSecClientHalf, libkb.PassphraseGeneration, error) {
	zeroGen := libkb.PassphraseGeneration(0)
	var dummy libkb.LKSecClientHalf

	secretStore := libkb.NewSecretStore(e.G(), e.arg.Me.GetNormalizedName())
	if secretStore == nil {
		return dummy, zeroGen, errors.New("No secret store available")
	}

	secret, err := secretStore.RetrieveSecret()
	if err != nil {
		return dummy, zeroGen, err
	}

	devid := e.G().Env.GetDeviceID()
	if devid.IsNil() {
		return dummy, zeroGen, fmt.Errorf("no device id set")
	}

	var dev libkb.DeviceKey
	aerr := e.G().LoginState().Account(func(a *libkb.Account) {
		if err = libkb.RunSyncer(a.SecretSyncer(), e.arg.Me.GetUID(), a.LoggedIn(), a.LocalSession()); err != nil {
			return
		}
		dev, err = a.SecretSyncer().FindDevice(devid)
	}, "BackupKeygen.Run() -- retrieving passphrase generation)")
	if aerr != nil {
		return dummy, zeroGen, aerr
	}
	if err != nil {
		return dummy, zeroGen, err
	}
	serverHalf, err := libkb.NewLKSecServerHalfFromHex(dev.LksServerHalf)
	if err != nil {
		return dummy, zeroGen, err
	}

	clientHalf := serverHalf.ComputeClientHalf(secret)

	return clientHalf, dev.PPGen, nil
}

func (e *PaperKeyGen) push(ctx *Context) error {
	if e.arg.SkipPush {
		return nil
	}

	// Create a new paper key device. Need the passphrase prefix
	// for the paper device name.  This is the first two words in
	// the passphrase.  There is sufficient entropy to cover this...
	backupDev, err := libkb.NewPaperDevice(e.arg.Passphrase.Prefix())
	if err != nil {
		return err
	}

	// create lks halves for this device.  Note that they aren't used for
	// local, encrypted storage of the paper keys, but just for recovery
	// purposes.

	foundStream := false
	var ppgen libkb.PassphraseGeneration
	var clientHalf libkb.LKSecClientHalf
	if ctx.LoginContext != nil {
		stream := ctx.LoginContext.PassphraseStreamCache().PassphraseStream()
		if stream != nil {
			foundStream = true
			ppgen = stream.Generation()
			clientHalf = stream.LksClientHalf()
		}
	} else {
		e.G().LoginState().Account(func(a *libkb.Account) {
			stream := a.PassphraseStream()
			if stream == nil {
				return
			}
			foundStream = true
			ppgen = stream.Generation()
			clientHalf = stream.LksClientHalf()
		}, "BackupKeygen - push")
	}

	// stream was nil, so we must have loaded lks from the secret
	// store.
	if !foundStream {
		clientHalf, ppgen, err = e.getClientHalfFromSecretStore()
		if err != nil {
			return err
		}
	}

	backupLks := libkb.NewLKSecWithClientHalf(clientHalf, ppgen, e.arg.Me.GetUID(), e.G())
	backupLks.SetServerHalf(libkb.NewLKSecServerHalfZeros())

	ctext, err := backupLks.EncryptClientHalfRecovery(e.encKey)
	if err != nil {
		return err
	}

	// post them to the server.
	var sr libkb.SessionReader
	if ctx.LoginContext != nil {
		sr = ctx.LoginContext.LocalSession()
	}
	if err := libkb.PostDeviceLKS(e.G(), sr, backupDev.ID, libkb.DeviceTypePaper, backupLks.GetServerHalf(), backupLks.Generation(), ctext, e.encKey.GetKID()); err != nil {
		return err
	}

	// push the paper signing key
	sigDel := libkb.Delegator{
		NewKey:         e.sigKey,
		DelegationType: libkb.DelegationTypeSibkey,
		Expire:         libkb.NaclEdDSAExpireIn,
		ExistingKey:    e.arg.SigningKey,
		Me:             e.arg.Me,
		Device:         backupDev,
		Contextified:   libkb.NewContextified(e.G()),
	}

	// push the paper encryption key
	sigEnc := libkb.Delegator{
		NewKey:         e.encKey,
		DelegationType: libkb.DelegationTypeSubkey,
		Expire:         libkb.NaclDHExpireIn,
		ExistingKey:    e.sigKey,
		Me:             e.arg.Me,
		Device:         backupDev,
		Contextified:   libkb.NewContextified(e.G()),
	}

	sdhBoxes, err := e.makeSharedDHSecretKeyBoxes(ctx)
	if err != nil {
		return err
	}

	return libkb.DelegatorAggregator(ctx.LoginContext, []libkb.Delegator{sigDel, sigEnc}, sdhBoxes)
}

func (e *PaperKeyGen) makeSharedDHSecretKeyBoxes(ctx *Context) ([]keybase1.SharedDHSecretKeyBox, error) {
	e.G().Log.CDebugf(ctx.NetContext, "PaperKeyGen#makeSharedDHSecretKeyBoxes(enabled:%v)", e.G().Env.GetEnableSharedDH())
	var sdhBoxes = []keybase1.SharedDHSecretKeyBox{}
	if e.G().Env.GetEnableSharedDH() {
		sdhk, err := e.getSharedDHKeyring()
		if err != nil {
			return nil, err
		}
		if !sdhk.HasAnyKeys() {
			// TODO if SDH_UPGRADE: may want to add a key here.
		} else {
			sdhBoxes, err = sdhk.PrepareBoxesForNewDevice(ctx.NetContext,
				e.encKey,            // receiver key: new paper key enc
				e.arg.EncryptionKey) // sender key: this device enc
			if err != nil {
				return nil, err
			}
		}
	}
	e.G().Log.CDebugf(ctx.NetContext, "PaperKeyGen#makeSharedDHSecretKeyBoxes -> %v", len(sdhBoxes))
	return sdhBoxes, nil
}

func (e *PaperKeyGen) getSharedDHKeyring() (ret *libkb.SharedDHKeyring, err error) {
	ret = e.arg.SharedDHKeyring
	if ret != nil {
		return
	}
	ret, err = e.G().GetSharedDHKeyring()
	return
}

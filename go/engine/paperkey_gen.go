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

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type PaperKeyGenArg struct {
	Passphrase libkb.PaperKeyPhrase
	SkipPush   bool

	// One of Me or UID is required
	// Me is required if not SkipPush
	Me  *libkb.User
	UID keybase1.UID

	SigningKey     libkb.GenericKey      // optional
	EncryptionKey  libkb.NaclDHKeyPair   // optional
	PerUserKeyring *libkb.PerUserKeyring // optional
}

// PaperKeyGen is an engine.
type PaperKeyGen struct {
	arg *PaperKeyGenArg

	// keys of the generated paper key
	sigKey   libkb.GenericKey
	encKey   libkb.NaclDHKeyPair
	deviceID keybase1.DeviceID

	libkb.Contextified
}

// NewPaperKeyGen creates a PaperKeyGen engine.
func NewPaperKeyGen(g *libkb.GlobalContext, arg *PaperKeyGenArg) *PaperKeyGen {
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
	// only need a device if pushing keys
	return Prereqs{
		Device: !e.arg.SkipPush,
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

func (e *PaperKeyGen) DeviceID() keybase1.DeviceID {
	return e.deviceID
}

func (e *PaperKeyGen) DeviceWithKeys() *libkb.DeviceWithKeys {
	return libkb.NewDeviceWithKeysOnly(e.sigKey, e.encKey)
}

// Run starts the engine.
func (e *PaperKeyGen) Run(m libkb.MetaContext) error {
	if !e.arg.SkipPush {
		err := e.syncPUK(m)
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
	if err := e.push(m); err != nil {
		return err
	}

	// no need to notify if key wasn't pushed to server
	// (e.g. in the case of using this engine to verify a key)
	if e.arg.SkipPush {
		return nil
	}

	e.G().KeyfamilyChanged(m.Ctx(), e.getUID())

	return nil
}

func (e *PaperKeyGen) getUID() keybase1.UID {
	if !e.arg.UID.IsNil() {
		return e.arg.UID
	}
	if e.arg.Me != nil {
		return e.arg.Me.GetUID()
	}
	return keybase1.UID("")
}

func (e *PaperKeyGen) syncPUK(m libkb.MetaContext) error {
	// Sync the per-user-key keyring before updating other things.
	pukring, err := e.getPerUserKeyring(m)
	if err != nil {
		return err
	}
	var upak *keybase1.UserPlusAllKeys
	if e.arg.Me != nil {
		tmp := e.arg.Me.ExportToUserPlusAllKeys()
		upak = &tmp
	}
	err = pukring.SyncWithExtras(m, upak)
	if err != nil {
		return err
	}
	return nil
}

func (e *PaperKeyGen) makeSigKey(seed []byte) error {
	pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(seed))
	if err != nil {
		return err
	}

	var key libkb.NaclSigningKeyPair
	copy(key.Public[:], pub[:])
	key.Private = &kbcrypto.NaclSigningKeyPrivate{}
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

func (e *PaperKeyGen) getClientHalfFromSecretStore(m libkb.MetaContext) (clientHalf libkb.LKSecClientHalf, ppgen libkb.PassphraseGeneration, err error) {
	defer m.Trace("PaperKeyGen#getClientHalfFromSecretStore", func() error { return err })

	secretStore := libkb.NewSecretStore(e.G(), e.arg.Me.GetNormalizedName())
	if secretStore == nil {
		return clientHalf, ppgen, errors.New("No secret store available")
	}

	secret, err := secretStore.RetrieveSecret(m)
	if err != nil {
		return clientHalf, ppgen, err
	}

	devid := e.G().Env.GetDeviceID()
	if devid.IsNil() {
		return clientHalf, ppgen, fmt.Errorf("no device id set")
	}
	var ss *libkb.SecretSyncer
	ss, err = m.ActiveDevice().SyncSecrets(m)
	if err != nil {
		return clientHalf, ppgen, err
	}
	var dev libkb.DeviceKey
	dev, err = ss.FindDevice(devid)
	if err != nil {
		return clientHalf, ppgen, err
	}
	serverHalf, err := libkb.NewLKSecServerHalfFromHex(dev.LksServerHalf)
	if err != nil {
		return clientHalf, ppgen, err
	}

	clientHalf = serverHalf.ComputeClientHalf(secret)

	return clientHalf, dev.PPGen, nil
}

func (e *PaperKeyGen) push(m libkb.MetaContext) (err error) {
	defer m.Trace("PaperKeyGen#push", func() error { return err })()
	if e.arg.SkipPush {
		return nil
	}

	if e.arg.Me == nil {
		return errors.New("no Me object but we wanted to push public keys")
	}

	// Create a new paper key device. Need the passphrase prefix
	// for the paper device name.  This is the first two words in
	// the passphrase.  There is sufficient entropy to cover this...
	backupDev, err := libkb.NewPaperDevice(e.arg.Passphrase.Prefix())
	if err != nil {
		return err
	}
	e.deviceID = backupDev.ID

	// create lks halves for this device.  Note that they aren't used for
	// local, encrypted storage of the paper keys, but just for recovery
	// purposes.
	m.Dump()

	// Clear the passphrase stream if it's outdated, just in case some
	// other device changed the passphrase.
	if err := m.G().ActiveDevice.ClearPassphraseStreamCacheIfOutdated(m); err != nil {
		return err
	}

	var ppgen libkb.PassphraseGeneration
	var clientHalf libkb.LKSecClientHalf
	if stream := m.PassphraseStream(); stream != nil {
		m.Debug("Got cached passphrase stream")
		clientHalf = stream.LksClientHalf()
		ppgen = stream.Generation()
	} else {
		m.Debug("Got nil passphrase stream; going to secret store")
		// stream was nil, so we must have loaded lks from the secret
		// store.
		clientHalf, ppgen, err = e.getClientHalfFromSecretStore(m)
		switch err.(type) {
		case nil:
		case libkb.SecretStoreError:
			// as a last resort try to prompt the user for their passphrase if
			// the SecretUI is present
			if m.UIs().HasUI(libkb.SecretUIKind) {
				if pps, _, perr := libkb.GetPassphraseStreamViaPrompt(m); pps != nil {
					clientHalf = pps.LksClientHalf()
					ppgen = pps.Generation()
				} else if perr != nil {
					return perr
				} else {
					return err
				}
			}
		default:
			return err
		}
	}

	backupLks := libkb.NewLKSecWithClientHalf(clientHalf, ppgen, e.arg.Me.GetUID())
	backupLks.SetServerHalf(libkb.NewLKSecServerHalfZeros())

	ctext, err := backupLks.EncryptClientHalfRecovery(e.encKey)
	if err != nil {
		return err
	}

	if err := libkb.PostDeviceLKS(m, backupDev.ID, libkb.DeviceTypePaper, backupLks.GetServerHalf(), backupLks.Generation(), ctext, e.encKey.GetKID()); err != nil {
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

	pukBoxes, err := e.makePerUserKeyBoxes(m)
	if err != nil {
		return err
	}

	m.Debug("PaperKeyGen#push running delegators")
	return libkb.DelegatorAggregator(m, []libkb.Delegator{sigDel, sigEnc}, nil, pukBoxes, nil, nil)
}

func (e *PaperKeyGen) makePerUserKeyBoxes(m libkb.MetaContext) ([]keybase1.PerUserKeyBox, error) {
	m.Debug("PaperKeyGen#makePerUserKeyBoxes")

	var pukBoxes []keybase1.PerUserKeyBox
	pukring, err := e.getPerUserKeyring(m)
	if err != nil {
		return nil, err
	}
	if pukring.HasAnyKeys() {
		if e.arg.EncryptionKey.IsNil() {
			return nil, errors.New("missing encryption key for creating paper key")
		}
		pukBox, err := pukring.PrepareBoxForNewDevice(m,
			e.encKey,            // receiver key: new paper key enc
			e.arg.EncryptionKey) // sender key: this device enc
		if err != nil {
			return nil, err
		}
		pukBoxes = append(pukBoxes, pukBox)
	}
	m.Debug("PaperKeyGen#makePerUserKeyBoxes -> %v", len(pukBoxes))
	return pukBoxes, nil
}

func (e *PaperKeyGen) getPerUserKeyring(mctx libkb.MetaContext) (ret *libkb.PerUserKeyring, err error) {
	ret = e.arg.PerUserKeyring
	if ret != nil {
		return
	}
	ret, err = e.G().GetPerUserKeyring(mctx.Ctx())
	return
}

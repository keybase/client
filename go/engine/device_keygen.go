// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type DeviceKeygenArgs struct {
	Me              *libkb.User
	DeviceID        keybase1.DeviceID
	DeviceName      string
	DeviceType      string
	Lks             *libkb.LKSec
	IsEldest        bool
	IsSelfProvision bool
	PerUserKeyring  *libkb.PerUserKeyring
	EkReboxer       *ephemeralKeyReboxer

	// Used in tests for reproducible key generation
	naclSigningKeyPair    libkb.NaclKeyPair
	naclEncryptionKeyPair libkb.NaclKeyPair
}

// DeviceKeygenPushArgs determines how the push will run.  There are
// currently three different paths it can take:
//
// 1. this device is the eldest device:  pushes eldest signing
// key, encryption subkey. (IsEldest => true)
//
// 2. this device is a sibling (but we're not in a key exchange
// scenario):  pushes sibkey signing key, encryption subkey.
// (IsEldest => False, SkipSignerPush => false, Signer != nil,
// EldestKID != nil)
//
// 3. this device is a sibling, but another device pushed
// the signing key, so skip that part.
// (IsEldest => False, SkipSignerPush => true, Signer != nil,
// EldestKID != nil)
//
// The User argument is optional, but it is necessary if the
// user's sigchain changes between key generation and key push.
//
type DeviceKeygenPushArgs struct {
	SkipSignerPush bool
	Signer         libkb.GenericKey
	EldestKID      keybase1.KID
	User           *libkb.User // optional
}

type DeviceKeygen struct {
	args *DeviceKeygenArgs

	runErr  error
	pushErr error

	naclSignGen *libkb.NaclKeyGen
	naclEncGen  *libkb.NaclKeyGen

	// can be nil
	perUserKeySeed *libkb.PerUserKeySeed

	libkb.Contextified
}

// NewDeviceKeygen creates a DeviceKeygen engine.
func NewDeviceKeygen(g *libkb.GlobalContext, args *DeviceKeygenArgs) *DeviceKeygen {
	return &DeviceKeygen{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *DeviceKeygen) Name() string {
	return "DeviceKeygen"
}

// GetPrereqs returns the engine prereqs.
func (e *DeviceKeygen) Prereqs() Prereqs {
	return Prereqs{TemporarySession: true}
}

// RequiredUIs returns the required UIs.
func (e *DeviceKeygen) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DeviceKeygen) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *DeviceKeygen) Run(m libkb.MetaContext) (err error) {
	defer m.Trace("DeviceKeygen#Run", func() error { return err })()

	e.setup(m)
	e.generate(m)
	e.localSave(m)
	return e.runErr
}

func (e *DeviceKeygen) SigningKeyPublic() (kbcrypto.NaclSigningKeyPublic, error) {
	s, ok := e.naclSignGen.GetKeyPair().(libkb.NaclSigningKeyPair)
	if !ok {
		return kbcrypto.NaclSigningKeyPublic{}, kbcrypto.BadKeyError{Msg: fmt.Sprintf("invalid key type %T", e.naclSignGen.GetKeyPair())}
	}
	return s.Public, nil

}

func (e *DeviceKeygen) SigningKey() libkb.NaclKeyPair {
	return e.naclSignGen.GetKeyPair()
}

func (e *DeviceKeygen) EncryptionKey() libkb.NaclDHKeyPair {
	return e.naclEncGen.GetKeyPair().(libkb.NaclDHKeyPair)
}

// Push pushes the generated keys to the api server and stores the
// local key security server half on the api server as well.
func (e *DeviceKeygen) Push(m libkb.MetaContext, pargs *DeviceKeygenPushArgs) (err error) {
	var encSigner libkb.GenericKey
	eldestKID := pargs.EldestKID

	ds := []libkb.Delegator{}

	m.Debug("DeviceKeygen#Push PUK(upgrade:%v)", m.G().Env.GetUpgradePerUserKey())

	var pukBoxes = []keybase1.PerUserKeyBox{}
	if e.G().Env.GetUpgradePerUserKey() && e.args.IsEldest {
		if e.perUserKeySeed == nil {
			return errors.New("missing new per user key")
		}
		// Encrypt the new per-user-key for this eldest device.
		pukBox, err := libkb.NewPerUserKeyBox(
			*e.perUserKeySeed, // inner key to be encrypted
			e.EncryptionKey(), // receiver key (device enc key)
			e.EncryptionKey(), // sender key   (device enc key)
			keybase1.PerUserKeyGeneration(1))
		if err != nil {
			return err
		}
		pukBoxes = append(pukBoxes, pukBox)
	}
	if !e.args.IsEldest || e.args.IsSelfProvision {
		boxes, err := e.preparePerUserKeyBoxFromProvisioningKey(m)
		if err != nil {
			return err
		}
		pukBoxes = append(pukBoxes, boxes...)
	}

	// append the signing key
	if e.args.IsEldest {
		ds = e.appendEldest(m, ds, pargs)
		encSigner = e.naclSignGen.GetKeyPair()
		eldestKID = encSigner.GetKID()
	} else if !pargs.SkipSignerPush {
		ds = e.appendSibkey(m, ds, pargs)
		encSigner = e.naclSignGen.GetKeyPair()
	} else {
		encSigner = pargs.Signer
	}

	ds = e.appendEncKey(m, ds, encSigner, eldestKID, pargs.User)

	var userEKReboxArg *keybase1.UserEkReboxArg
	if e.args.IsSelfProvision {
		userEKReboxArg, err = e.reboxUserEK(m, encSigner)
		if err != nil {
			return err
		}
	}

	var pukSigProducer libkb.AggSigProducer // = nil
	// PerUserKey does not use Delegator.
	if e.G().Env.GetUpgradePerUserKey() && e.args.IsEldest {
		// Sign in the new per-user-key
		if e.perUserKeySeed == nil {
			return errors.New("missing new per user key")
		}

		pukSigProducer = func() (libkb.JSONPayload, keybase1.Seqno, libkb.LinkID, error) {
			gen := keybase1.PerUserKeyGeneration(1)
			rev, err := libkb.PerUserKeyProofReverseSigned(m, e.args.Me, *e.perUserKeySeed, gen, encSigner)
			if err != nil {
				return nil, 0, nil, err
			}
			return rev.Payload, rev.Seqno, rev.LinkID, nil
		}
	}

	e.pushErr = libkb.DelegatorAggregator(m, ds, pukSigProducer, pukBoxes, nil, userEKReboxArg)

	// push the LKS server half
	e.pushLKS(m)

	return e.pushErr
}

func (e *DeviceKeygen) setup(m libkb.MetaContext) {
	defer m.Trace("DeviceKeygen#setup", func() error { return e.runErr })()
	if e.runErr != nil {
		return
	}

	if m.G().Env.GetRunMode() != libkb.DevelRunMode &&
		(e.args.naclSigningKeyPair != nil || e.args.naclEncryptionKeyPair != nil) {
		e.runErr = errors.New("trying to pass a key pair agument to device keygen")
		return
	}

	e.naclSignGen = e.newNaclKeyGen(m, func() (libkb.NaclKeyPair, error) {
		if e.args.naclSigningKeyPair != nil {
			return e.args.naclSigningKeyPair, nil
		}
		kp, err := libkb.GenerateNaclSigningKeyPair()
		if err != nil {
			return nil, err
		}
		return kp, nil
	}, e.device(), libkb.NaclEdDSAExpireIn)

	e.naclEncGen = e.newNaclKeyGen(m, func() (libkb.NaclKeyPair, error) {
		if e.args.naclEncryptionKeyPair != nil {
			return e.args.naclEncryptionKeyPair, nil
		}
		kp, err := libkb.GenerateNaclDHKeyPair()
		if err != nil {
			return nil, err
		}
		return kp, nil
	}, e.device(), libkb.NaclDHExpireIn)
}

func (e *DeviceKeygen) generate(m libkb.MetaContext) {
	defer m.Trace("DeviceKeygen#generate", func() error { return e.runErr })()
	if e.runErr != nil {
		return
	}

	if e.runErr = e.naclSignGen.Generate(); e.runErr != nil {
		return
	}

	if e.runErr = e.naclEncGen.Generate(); e.runErr != nil {
		return
	}

	if e.G().Env.GetUpgradePerUserKey() && e.args.IsEldest {
		seed, err := libkb.GeneratePerUserKeySeed()
		if err != nil {
			e.runErr = err
			return
		}
		e.perUserKeySeed = &seed
	}

}

func (e *DeviceKeygen) localSave(m libkb.MetaContext) {
	defer m.Trace("DeviceKeygen#localSave", func() error { return e.runErr })()
	if e.runErr != nil {
		return
	}
	if e.runErr = e.naclSignGen.SaveLKS(m, e.args.Lks); e.runErr != nil {
		return
	}
	if e.runErr = e.naclEncGen.SaveLKS(m, e.args.Lks); e.runErr != nil {
		return
	}
}

func (e *DeviceKeygen) reboxUserEK(m libkb.MetaContext, signingKey libkb.GenericKey) (reboxArg *keybase1.UserEkReboxArg, err error) {
	defer m.Trace("DeviceKeygen#reboxUserEK", func() error { return err })()
	ekKID, err := e.args.EkReboxer.getDeviceEKKID(m)
	if err != nil {
		return nil, err
	}
	userEKBox, err := makeUserEKBoxForProvisionee(m, ekKID)
	if err != nil {
		return nil, err
	}
	return e.args.EkReboxer.getReboxArg(m, userEKBox, e.args.DeviceID, signingKey)
}

func (e *DeviceKeygen) appendEldest(m libkb.MetaContext, ds []libkb.Delegator, pargs *DeviceKeygenPushArgs) []libkb.Delegator {
	defer m.Trace("DeviceKeygen#appendEldest", func() error { return e.pushErr })()
	if e.pushErr != nil {
		return ds
	}

	var d libkb.Delegator
	d, e.pushErr = e.naclSignGen.Push(m, true)
	if e.pushErr == nil {
		return append(ds, d)
	}

	return ds
}

func (e *DeviceKeygen) appendSibkey(m libkb.MetaContext, ds []libkb.Delegator, pargs *DeviceKeygenPushArgs) []libkb.Delegator {
	defer m.Trace("DeviceKeygen#appendSibkey", func() error { return e.pushErr })()
	if e.pushErr != nil {
		return ds
	}

	var d libkb.Delegator

	e.naclSignGen.UpdateArg(pargs.Signer, pargs.EldestKID, libkb.DelegationTypeSibkey, pargs.User)
	d, e.pushErr = e.naclSignGen.Push(m, true)
	if e.pushErr == nil {
		return append(ds, d)
	}

	return ds
}

func (e *DeviceKeygen) appendEncKey(m libkb.MetaContext, ds []libkb.Delegator, signer libkb.GenericKey, eldestKID keybase1.KID, user *libkb.User) []libkb.Delegator {
	defer m.Trace("DeviceKeygen#appendEncKey", func() error { return e.pushErr })()
	if e.pushErr != nil {
		return ds
	}

	e.naclEncGen.UpdateArg(signer, eldestKID, libkb.DelegationTypeSubkey, user)

	var d libkb.Delegator
	d, e.pushErr = e.naclEncGen.Push(m, true)
	if e.pushErr == nil {
		return append(ds, d)
	}

	return ds
}

func (e *DeviceKeygen) generateClientHalfRecovery(m libkb.MetaContext) (ctext string, kid keybase1.KID, err error) {
	defer m.Trace("DeviceKeygen#generateClientHalfRecovery", func() error { return err })()
	key := e.naclEncGen.GetKeyPair()
	kid = key.GetKID()
	ctext, err = e.args.Lks.EncryptClientHalfRecovery(key)
	return ctext, kid, err
}

func (e *DeviceKeygen) pushLKS(m libkb.MetaContext) {
	defer m.Trace("DeviceKeygen#pushLKS", func() error { return e.pushErr })()

	if e.pushErr != nil {
		return
	}

	if e.args.Lks == nil {
		e.pushErr = errors.New("no local key security set")
		return
	}

	serverHalf := e.args.Lks.GetServerHalf()
	if serverHalf.IsNil() {
		e.pushErr = errors.New("LKS server half is empty, and should not be")
		return
	}

	var chr string
	var chrk keybase1.KID
	if chr, chrk, e.pushErr = e.generateClientHalfRecovery(m); e.pushErr != nil {
		return
	}

	e.pushErr = libkb.PostDeviceLKS(m, e.args.DeviceID, e.args.DeviceType, serverHalf, e.args.Lks.Generation(), chr, chrk)
	if e.pushErr != nil {
		return
	}
}

func (e *DeviceKeygen) newNaclKeyGen(m libkb.MetaContext, gen libkb.NaclGenerator, device *libkb.Device, expire int) *libkb.NaclKeyGen {
	return libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Generator: gen,
		Device:    device,
		Me:        e.args.Me,
		ExpireIn:  expire,
	})
}

func (e *DeviceKeygen) device() *libkb.Device {
	s := libkb.DeviceStatusActive
	return &libkb.Device{
		ID:          e.args.DeviceID,
		Description: &e.args.DeviceName,
		Type:        e.args.DeviceType,
		Status:      &s,
	}
}

// Can return no boxes if there are no per-user-keys.
func (e *DeviceKeygen) preparePerUserKeyBoxFromProvisioningKey(m libkb.MetaContext) ([]keybase1.PerUserKeyBox, error) {
	// Assuming this is a paperkey or self provision.

	upak := e.args.Me.ExportToUserPlusAllKeys()
	if len(upak.Base.PerUserKeys) == 0 {
		m.Debug("DeviceKeygen skipping per-user-keys, none exist")
		return nil, nil
	}

	pukring := e.args.PerUserKeyring
	if pukring == nil {
		return nil, errors.New("missing PerUserKeyring")
	}

	provisioningKey := m.ActiveDevice().ProvisioningKey(m)
	var provisioningSigKey, provisioningEncKeyGeneric libkb.GenericKey
	if provisioningKey != nil {
		provisioningSigKey = provisioningKey.SigningKey()
		provisioningEncKeyGeneric = provisioningKey.EncryptionKey()
	}

	if provisioningSigKey == nil && provisioningEncKeyGeneric == nil {
		// GPG provisioning is not supported when the user has per-user-keys.
		// This is the error that manifests. See CORE-4960
		return nil, errors.New("missing provisioning key in login context")
	}
	if provisioningSigKey == nil {
		return nil, errors.New("missing provisioning sig key")
	}
	if provisioningEncKeyGeneric == nil {
		return nil, errors.New("missing provisioning enc key")
	}
	provisioningEncKey, ok := provisioningEncKeyGeneric.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, errors.New("Unexpected encryption key type")
	}

	provisioningDeviceID, err := upak.GetDeviceID(provisioningSigKey.GetKID())
	if err != nil {
		return nil, err
	}
	err = pukring.SyncAsProvisioningKey(m, &upak, provisioningDeviceID, provisioningEncKey)
	if err != nil {
		return nil, err
	}
	if !pukring.HasAnyKeys() {
		return nil, nil
	}
	pukBox, err := pukring.PrepareBoxForNewDevice(m,
		e.EncryptionKey(),  // receiver key: provisionee enc
		provisioningEncKey, // sender key: provisioning key enc
	)
	return []keybase1.PerUserKeyBox{pukBox}, err
}

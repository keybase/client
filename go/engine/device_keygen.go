// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type DeviceKeygenArgs struct {
	Me             *libkb.User
	DeviceID       keybase1.DeviceID
	DeviceName     string
	DeviceType     string
	Lks            *libkb.LKSec
	IsEldest       bool
	PerUserKeyring *libkb.PerUserKeyring // optional in some cases
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
func NewDeviceKeygen(args *DeviceKeygenArgs, g *libkb.GlobalContext) *DeviceKeygen {
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
	return Prereqs{Session: true}
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
func (e *DeviceKeygen) Run(ctx *Context) error {
	e.setup(ctx)
	e.generate()
	e.localSave(ctx)
	return e.runErr
}

func (e *DeviceKeygen) SigningKeyPublic() (libkb.NaclSigningKeyPublic, error) {
	s, ok := e.naclSignGen.GetKeyPair().(libkb.NaclSigningKeyPair)
	if !ok {
		return libkb.NaclSigningKeyPublic{}, libkb.BadKeyError{Msg: fmt.Sprintf("invalid key type %T", e.naclSignGen.GetKeyPair())}
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
func (e *DeviceKeygen) Push(ctx *Context, pargs *DeviceKeygenPushArgs) error {
	var encSigner libkb.GenericKey
	eldestKID := pargs.EldestKID

	ds := []libkb.Delegator{}

	if e.G().Env.GetSupportPerUserKey() {
		e.G().Log.CDebugf(ctx.NetContext, "DeviceKeygen#Push PUK(support:%v, upgrade:%v)",
			e.G().Env.GetSupportPerUserKey(), e.G().Env.GetUpgradePerUserKey())
	}

	var pukBoxes = []keybase1.PerUserKeyBox{}
	if e.G().Env.GetUpgradePerUserKey() && e.args.IsEldest {
		if e.perUserKeySeed == nil {
			return errors.New("missing new per user key")
		}
		// Encrypt the new sdh key for this eldest device.
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
	if e.G().Env.GetSupportPerUserKey() && !e.args.IsEldest {
		boxes, err := e.preparePerUserKeyBoxFromPaperkey(ctx)
		if err != nil {
			return err
		}
		pukBoxes = append(pukBoxes, boxes...)
	}

	// append the signing key
	if e.args.IsEldest {
		ds = e.appendEldest(ds, ctx, pargs)
		encSigner = e.naclSignGen.GetKeyPair()
		eldestKID = encSigner.GetKID()
	} else if !pargs.SkipSignerPush {
		ds = e.appendSibkey(ds, ctx, pargs)
		encSigner = e.naclSignGen.GetKeyPair()
	} else {
		encSigner = pargs.Signer
	}

	ds = e.appendEncKey(ds, ctx, encSigner, eldestKID, pargs.User)

	var pukSigProducer libkb.AggSigProducer = nil

	// PerUserKey does not use Delegator.
	if e.G().Env.GetUpgradePerUserKey() && e.args.IsEldest {
		// Sign in the new per-user-key
		if e.perUserKeySeed == nil {
			return errors.New("missing new per user key")
		}

		pukSigProducer = func() (libkb.JSONPayload, error) {
			return e.makePerUserKeySig(e.args.Me, *e.perUserKeySeed, encSigner)
		}
	}

	e.pushErr = libkb.DelegatorAggregator(ctx.LoginContext, ds, pukSigProducer, pukBoxes, nil)

	// push the LKS server half
	e.pushLKS(ctx)

	return e.pushErr
}

func (e *DeviceKeygen) setup(ctx *Context) {
	if e.runErr != nil {
		return
	}

	e.naclSignGen = e.newNaclKeyGen(ctx, func() (libkb.NaclKeyPair, error) {
		kp, err := libkb.GenerateNaclSigningKeyPair()
		if err != nil {
			return nil, err
		}
		return kp, nil
	}, e.device(), libkb.NaclEdDSAExpireIn)

	e.naclEncGen = e.newNaclKeyGen(ctx, func() (libkb.NaclKeyPair, error) {
		kp, err := libkb.GenerateNaclDHKeyPair()
		if err != nil {
			return nil, err
		}
		return kp, nil
	}, e.device(), libkb.NaclDHExpireIn)

}

func (e *DeviceKeygen) generate() {
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

func (e *DeviceKeygen) localSave(ctx *Context) {
	if e.runErr != nil {
		return
	}

	if e.runErr = e.naclSignGen.SaveLKS(e.G(), e.args.Lks, ctx.LoginContext); e.runErr != nil {
		return
	}
	if e.runErr = e.naclEncGen.SaveLKS(e.G(), e.args.Lks, ctx.LoginContext); e.runErr != nil {
		return
	}
}

func (e *DeviceKeygen) appendEldest(ds []libkb.Delegator, ctx *Context, pargs *DeviceKeygenPushArgs) []libkb.Delegator {
	if e.pushErr != nil {
		return ds
	}

	var d libkb.Delegator
	d, e.pushErr = e.naclSignGen.Push(ctx.LoginContext, true)
	if e.pushErr == nil {
		d.SetGlobalContext(e.G())
		return append(ds, d)
	}

	return ds
}

func (e *DeviceKeygen) appendSibkey(ds []libkb.Delegator, ctx *Context, pargs *DeviceKeygenPushArgs) []libkb.Delegator {
	if e.pushErr != nil {
		return ds
	}

	var d libkb.Delegator

	e.naclSignGen.UpdateArg(pargs.Signer, pargs.EldestKID, libkb.DelegationTypeSibkey, pargs.User)
	d, e.pushErr = e.naclSignGen.Push(ctx.LoginContext, true)
	if e.pushErr == nil {
		d.SetGlobalContext(e.G())
		return append(ds, d)
	}

	return ds
}

func (e *DeviceKeygen) appendEncKey(ds []libkb.Delegator, ctx *Context, signer libkb.GenericKey, eldestKID keybase1.KID, user *libkb.User) []libkb.Delegator {
	if e.pushErr != nil {
		return ds
	}

	e.naclEncGen.UpdateArg(signer, eldestKID, libkb.DelegationTypeSubkey, user)

	var d libkb.Delegator
	d, e.pushErr = e.naclEncGen.Push(ctx.LoginContext, true)
	if e.pushErr == nil {
		d.SetGlobalContext(e.G())
		return append(ds, d)
	}

	return ds
}

func (e *DeviceKeygen) generateClientHalfRecovery() (string, keybase1.KID, error) {
	key := e.naclEncGen.GetKeyPair()
	kid := key.GetKID()
	ctext, err := e.args.Lks.EncryptClientHalfRecovery(key)
	return ctext, kid, err
}

func (e *DeviceKeygen) pushLKS(ctx *Context) {
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
	if chr, chrk, e.pushErr = e.generateClientHalfRecovery(); e.pushErr != nil {
		return
	}

	// send it to api server
	var sr libkb.SessionReader
	if ctx.LoginContext != nil {
		sr = ctx.LoginContext.LocalSession()
	}
	e.pushErr = libkb.PostDeviceLKS(e.G(), sr, e.args.DeviceID, e.args.DeviceType, serverHalf, e.args.Lks.Generation(), chr, chrk)
	if e.pushErr != nil {
		return
	}

	// Sync the LKS stuff back from the server, so that subsequent
	// attempts to use public key login will work.
	if ctx.LoginContext != nil {
		e.pushErr = ctx.LoginContext.RunSecretSyncer(e.args.Me.GetUID())
	} else {
		e.pushErr = e.G().LoginState().RunSecretSyncer(e.args.Me.GetUID())
	}
}

func (e *DeviceKeygen) newNaclKeyGen(ctx *Context, gen libkb.NaclGenerator, device *libkb.Device, expire int) *libkb.NaclKeyGen {
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
func (e *DeviceKeygen) preparePerUserKeyBoxFromPaperkey(ctx *Context) ([]keybase1.PerUserKeyBox, error) {
	if !e.G().Env.GetSupportPerUserKey() {
		return nil, errors.New("per-user-keys disabled")
	}
	// Assuming this is a paperkey provision.

	pukring := e.args.PerUserKeyring
	if pukring == nil {
		return nil, errors.New("missing PerUserKeyring")
	}

	if ctx.LoginContext == nil {
		return nil, errors.New("no login context to push new device keys")
	}

	paperSigKey := ctx.LoginContext.GetUnlockedPaperSigKey()
	paperEncKeyGeneric := ctx.LoginContext.GetUnlockedPaperEncKey()
	if paperSigKey == nil {
		return nil, errors.New("missing paper sig key")
	}
	if paperEncKeyGeneric == nil {
		return nil, errors.New("missing paper enc key")
	}
	paperEncKey, ok := paperEncKeyGeneric.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, errors.New("Unexpected encryption key type")
	}

	upak := e.args.Me.ExportToUserPlusAllKeys(keybase1.Time(0))
	paperDeviceID, err := upak.GetDeviceID(paperSigKey.GetKID())
	if err != nil {
		return nil, err
	}
	err = pukring.SyncAsPaperKey(ctx.NetContext, ctx.LoginContext, &upak, paperDeviceID, paperEncKey)
	if err != nil {
		return nil, err
	}
	if !pukring.HasAnyKeys() {
		return nil, nil
	}
	pukBox, err := pukring.PrepareBoxForNewDevice(ctx.NetContext,
		e.EncryptionKey(), // receiver key: provisionee enc
		paperEncKey,       // sender key: paper key enc
	)
	return []keybase1.PerUserKeyBox{pukBox}, err
}

func (e *DeviceKeygen) makePerUserKeySig(me *libkb.User, pukSeed libkb.PerUserKeySeed, signer libkb.GenericKey) (libkb.JSONPayload, error) {
	gen := keybase1.PerUserKeyGeneration(1)

	pukSigKey, err := pukSeed.DeriveSigningKey()
	if err != nil {
		return nil, err
	}

	pukEncKey, err := pukSeed.DeriveDHKey()
	if err != nil {
		return nil, err
	}

	// Make reverse sig
	jwRev, err := libkb.PerUserKeyProof(me, pukSigKey.GetKID(), pukEncKey.GetKID(), gen, signer, nil)
	if err != nil {
		return nil, err
	}
	reverseSig, _, _, err := libkb.SignJSON(jwRev, pukSigKey)
	if err != nil {
		return nil, err
	}

	// Make sig
	jw, err := libkb.PerUserKeyProof(me, pukSigKey.GetKID(), pukEncKey.GetKID(), gen, signer, &reverseSig)
	if err != nil {
		return nil, err
	}
	sig, _, _, err := libkb.SignJSON(jw, signer)
	if err != nil {
		return nil, err
	}

	publicKeysEntry := make(libkb.JSONPayload)
	publicKeysEntry["signing"] = pukSigKey.GetKID().String()
	publicKeysEntry["encryption"] = pukEncKey.GetKID().String()

	res := make(libkb.JSONPayload)
	res["sig"] = sig
	res["signing_kid"] = signer.GetKID().String()
	res["type"] = libkb.LinkTypePerUserKey
	res["public_keys"] = publicKeysEntry
	return res, nil
}

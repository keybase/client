// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type DeviceKeygenArgs struct {
	Me         *libkb.User
	DeviceID   keybase1.DeviceID
	DeviceName string
	DeviceType string
	Lks        *libkb.LKSec
	IsEldest   bool
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
	naclSharedDHGen *libkb.NaclKeyGen

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

func (e *DeviceKeygen) sharedDHKey() libkb.NaclDHKeyPair {
	return e.naclSharedDHGen.GetKeyPair().(libkb.NaclDHKeyPair)
}

// Push pushes the generated keys to the api server and stores the
// local key security server half on the api server as well.
func (e *DeviceKeygen) Push(ctx *Context, pargs *DeviceKeygenPushArgs) error {
	var encSigner libkb.GenericKey
	eldestKID := pargs.EldestKID

	ds := []libkb.Delegator{}

	var sdhBoxes = []libkb.SharedDHSecretKeyBox{}
	if e.G().Env.GetEnableSharedDH() {
		sdh1, err := libkb.NewSharedDHSecretKeyBox(
			e.sharedDHKey(),   // inner key to be encrypted (shared dh key)
			e.EncryptionKey(), // receiver key (device enc key)
			e.EncryptionKey(), // sender key   (device enc key)
			libkb.SharedDHKeyGeneration(1))
		if err != nil {
			return err
		}
		sdhBoxes = append(sdhBoxes, sdh1)
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

	if e.G().Env.GetEnableSharedDH() && e.args.IsEldest {
		ds = e.appendSharedDHKey(ds, ctx, encSigner, eldestKID, pargs.User)
	}

	e.pushErr = libkb.DelegatorAggregator(ctx.LoginContext, ds, sdhBoxes)

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

	if e.G().Env.GetEnableSharedDH() && e.args.IsEldest {
		e.naclSharedDHGen = e.newNaclKeyGen(ctx, func() (libkb.NaclKeyPair, error) {
			kp, err := libkb.GenerateNaclDHKeyPair()
			if err != nil {
				return nil, err
			}
			return kp, nil
		}, nil, libkb.NaclDHExpireIn)
	}
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

	if e.naclSharedDHGen != nil {
		if e.runErr = e.naclSharedDHGen.Generate(); e.runErr != nil {
			return
		}
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

func (e *DeviceKeygen) appendSharedDHKey(ds []libkb.Delegator, ctx *Context, signer libkb.GenericKey, eldestKID keybase1.KID, user *libkb.User) []libkb.Delegator {
	if e.pushErr != nil {
		return ds
	}

	e.naclSharedDHGen.UpdateArg(signer, eldestKID, libkb.DelegationTypeSharedDHKey, user)

	var d libkb.Delegator
	d, e.pushErr = e.naclSharedDHGen.Push(ctx.LoginContext, true)
	d.SharedDHKeyGeneration = libkb.SharedDHKeyGeneration(1)
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
		e.pushErr = fmt.Errorf("no local key security set")
		return
	}

	serverHalf := e.args.Lks.GetServerHalf()
	if serverHalf.IsNil() {
		e.pushErr = fmt.Errorf("LKS server half is empty, and should not be")
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

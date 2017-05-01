// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type RevokeMode int

const (
	RevokeKey RevokeMode = iota
	RevokeDevice
)

type RevokeEngine struct {
	libkb.Contextified
	deviceID keybase1.DeviceID
	kid      keybase1.KID
	mode     RevokeMode
	force    bool
}

type RevokeDeviceEngineArgs struct {
	ID    keybase1.DeviceID
	Force bool
}

func NewRevokeDeviceEngine(args RevokeDeviceEngineArgs, g *libkb.GlobalContext) *RevokeEngine {
	return &RevokeEngine{
		deviceID:     args.ID,
		mode:         RevokeDevice,
		force:        args.Force,
		Contextified: libkb.NewContextified(g),
	}
}

func NewRevokeKeyEngine(kid keybase1.KID, g *libkb.GlobalContext) *RevokeEngine {
	return &RevokeEngine{
		kid:          kid,
		mode:         RevokeKey,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *RevokeEngine) Name() string {
	return "Revoke"
}

func (e *RevokeEngine) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

func (e *RevokeEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

func (e *RevokeEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (e *RevokeEngine) getKIDsToRevoke(me *libkb.User) ([]keybase1.KID, error) {
	if e.mode == RevokeDevice {
		deviceKeys, err := me.GetComputedKeyFamily().GetAllActiveKeysForDevice(e.deviceID)
		if err != nil {
			return nil, err
		}
		if len(deviceKeys) == 0 {
			return nil, fmt.Errorf("No active keys to revoke for device %s.", e.deviceID)
		}
		return deviceKeys, nil
	} else if e.mode == RevokeKey {
		kid := e.kid
		key, err := me.GetComputedKeyFamily().FindKeyWithKIDUnsafe(kid)
		if err != nil {
			return nil, err
		}
		if !libkb.IsPGP(key) {
			return nil, fmt.Errorf("Key %s is not a PGP key. To revoke device keys, use the `device remove` command.", e.kid)
		}
		for _, activePGPKey := range me.GetComputedKeyFamily().GetActivePGPKeys(false /* sibkeys only */) {
			if activePGPKey.GetKID().Equal(kid) {
				return []keybase1.KID{kid}, nil
			}
		}
		return nil, fmt.Errorf("PGP key %s is not active", e.kid)
	} else {
		return nil, fmt.Errorf("Unknown revoke mode: %d", e.mode)
	}
}

func (e *RevokeEngine) Run(ctx *Context) error {
	e.G().Log.CDebugf(ctx.NetContext, "RevokeEngine#Run (mode:%v)", e.mode)

	currentDevice := e.G().Env.GetDeviceID()
	var deviceID keybase1.DeviceID
	if e.mode == RevokeDevice {
		deviceID = e.deviceID
		if e.deviceID == currentDevice && !e.force {
			return fmt.Errorf("Can't revoke the current device.")
		}
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	kidsToRevoke, err := e.getKIDsToRevoke(me)
	if err != nil {
		return err
	}
	ctx.LogUI.Info("Revoking KIDs:")
	for _, kid := range kidsToRevoke {
		ctx.LogUI.Info("  %s", kid)
	}

	sigKey, encKey, err := e.getDeviceSecretKeys(ctx, me)
	if err != nil {
		return err
	}

	if e.G().Env.GetEnableSharedDH() {
		if encKey == nil {
			return fmt.Errorf("Missing encryption key")
		}
	}

	// Whether to use this opportunity to create a first DH key for this user.
	// TODO replace this with an additional flag
	enableSharedDHUpgrading := e.G().Env.GetEnableSharedDH()

	var sdhBoxes []keybase1.SharedDHSecretKeyBox

	// Whether this run is creating a new sdh key. Set later.
	addingNewSDH := false

	// Only used if addingNewSDH
	var newSdhGeneration keybase1.SharedDHKeyGeneration
	var sdhGen *libkb.NaclKeyGen
	var newSdhKeyPair libkb.NaclDHKeyPair

	if e.G().Env.GetEnableSharedDH() {
		// Sync the SDH keyring
		err = e.G().BumpSharedDHKeyring()
		if err != nil {
			return err
		}
		sdhk, err := e.G().GetSharedDHKeyring()
		if err != nil {
			return err
		}
		err = sdhk.Sync(ctx.NetContext)
		if err != nil {
			return err
		}

		newSdhGeneration = sdhk.CurrentGeneration() + 1

		// Add a new key if the user already has sdh keys or upgrading is enabled.
		addingNewSDH = (newSdhGeneration > 1 || enableSharedDHUpgrading)

		if addingNewSDH {
			// Make a new SDH key
			newSdhKeyPair, sdhGen, err = e.generateNewSharedDHKey(ctx.NetContext, me)
			if err != nil {
				return err
			}

			// Get the receivers who will be able to decrypt the new sdh key
			sdhReceivers, err := e.getSdhReceivers(ctx, me, kidsToRevoke)
			if err != nil {
				return err
			}

			// Create boxes of the new SDH key
			sdhBoxesInner, err := sdhk.PrepareBoxesForDevices(ctx.NetContext,
				newSdhKeyPair, newSdhGeneration, sdhReceivers, *encKey)
			if err != nil {
				return err
			}
			sdhBoxes = sdhBoxesInner
		}
	}

	sigsList := []map[string]string{}

	// Push the sdh sig
	if e.G().Env.GetEnableSharedDH() && addingNewSDH {
		sig1, err := e.makeSdhSig(ctx, me, sdhGen, newSdhGeneration, sigKey)
		if err != nil {
			return err
		}
		sigsList = append(sigsList, sig1)
	}

	// Push the revoke sig
	sig2, err := e.makeRevokeSig(ctx, me, sigKey, kidsToRevoke, deviceID)
	if err != nil {
		return err
	}
	sigsList = append(sigsList, sig2)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList

	// Post the shared dh key encrypted for each active device.
	if len(sdhBoxes) > 0 {
		e.G().Log.CDebugf(ctx.NetContext, "RevokeEngine#Run sdhBoxes:%v boxes for generation %v", len(sdhBoxes), newSdhGeneration)
		payload["shared_dh_secret_boxes"] = sdhBoxes
		payload["shared_dh_generation"] = newSdhGeneration
	} else {
		e.G().Log.CDebugf(ctx.NetContext, "RevokeEngine#Run sdhBoxes:0", len(sdhBoxes))
	}

	_, err = e.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}

	if e.G().Env.GetEnableSharedDH() && addingNewSDH {
		// Add the sdh key locally
		sdhk, err := e.G().GetSharedDHKeyring()
		if err != nil {
			return err
		}
		err = sdhk.AddKey(ctx.NetContext, newSdhGeneration, newSdhKeyPair)
		if err != nil {
			return err
		}
	}

	e.G().UserChanged(me.GetUID())

	return nil
}

// Get the full keys for this device.
// Returns (sigKey, encKey, err)
// encKey will be nil iff SharedDH is disabled
func (e *RevokeEngine) getDeviceSecretKeys(ctx *Context, me *libkb.User) (libkb.GenericKey, *libkb.NaclDHKeyPair, error) {
	skaSig := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	sigKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(skaSig, "to revoke another key"))
	if err != nil {
		return nil, nil, err
	}
	if err = sigKey.CheckSecretKey(); err != nil {
		return nil, nil, err
	}

	var encKey *libkb.NaclDHKeyPair
	if e.G().Env.GetEnableSharedDH() {
		skaEnc := libkb.SecretKeyArg{
			Me:      me,
			KeyType: libkb.DeviceEncryptionKeyType,
		}
		encKeyGeneric, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(skaEnc, "to revoke another key"))
		if err != nil {
			return nil, nil, err
		}
		encKey2, ok := encKeyGeneric.(libkb.NaclDHKeyPair)
		if !ok {
			return nil, nil, fmt.Errorf("Unexpected encryption key type: %T", encKeyGeneric)
		}
		encKey = &encKey2
		if err = encKey.CheckSecretKey(); err != nil {
			return nil, nil, err
		}
	}

	return sigKey, encKey, err
}

func (e *RevokeEngine) makeSdhSig(ctx *Context, me *libkb.User, sdhGen *libkb.NaclKeyGen,
	sdhKeyGeneration keybase1.SharedDHKeyGeneration, sigKey libkb.GenericKey) (map[string]string, error) {

	sdhGen.UpdateArg(sigKey, me.GetEldestKID(), libkb.DelegationTypeSharedDHKey, me)

	// get a delegator
	d, err := sdhGen.Push(ctx.LoginContext, true)
	if err != nil {
		return nil, err
	}
	d.SharedDHKeyGeneration = keybase1.SharedDHKeyGeneration(sdhKeyGeneration)
	d.SetGlobalContext(e.G())

	sigEntry, err := d.RunNoPost(ctx.LoginContext)
	if err != nil {
		return nil, err
	}

	return sigEntry, nil
}

func (e *RevokeEngine) makeRevokeSig(ctx *Context, me *libkb.User, sigKey libkb.GenericKey,
	kidsToRevoke []keybase1.KID, deviceID keybase1.DeviceID) (map[string]string, error) {

	proof, err := me.RevokeKeysProof(sigKey, kidsToRevoke, deviceID)
	if err != nil {
		return nil, err
	}
	sig, _, _, err := libkb.SignJSON(proof, sigKey)
	if err != nil {
		return nil, err
	}

	sig1 := make(map[string]string)
	sig1["sig"] = sig
	sig1["signing_kid"] = sigKey.GetKID().String()
	sig1["type"] = libkb.LinkTypeRevoke
	return sig1, nil
}

// Get the receivers of the new sdh key boxes.
// Includes all device subkeys except any being revoked by this engine.
func (e *RevokeEngine) getSdhReceivers(ctx *Context, me *libkb.User, exclude []keybase1.KID) (res []libkb.NaclDHKeyPair, err error) {
	excludeMap := make(map[keybase1.KID]bool)
	for _, kid := range exclude {
		excludeMap[kid] = true
	}

	ckf := me.GetComputedKeyFamily()

	for _, dev := range ckf.GetAllActiveDevices() {
		keyGeneric, err := ckf.GetEncryptionSubkeyForDevice(dev.ID)
		if err != nil {
			return nil, err
		}
		if !excludeMap[keyGeneric.GetKID()] {
			key, ok := keyGeneric.(libkb.NaclDHKeyPair)
			if !ok {
				return nil, fmt.Errorf("Unexpected encryption key type: %T", keyGeneric)
			}
			res = append(res, key)
		}
	}
	return res, nil
}

// Generate a new shared dh key
// Returns the key and the used generator which can emit a Delegator.
func (e *RevokeEngine) generateNewSharedDHKey(ctx context.Context, me *libkb.User) (libkb.NaclDHKeyPair, *libkb.NaclKeyGen, error) {
	naclSharedDHGen := libkb.NewNaclKeyGen(libkb.NaclKeyGenArg{
		Generator: func() (libkb.NaclKeyPair, error) {
			kp, err := libkb.GenerateNaclDHKeyPair()
			if err != nil {
				return nil, err
			}
			return kp, nil
		},
		Me:       me,
		ExpireIn: libkb.NaclDHExpireIn,
	})

	err := naclSharedDHGen.Generate()
	if err != nil {
		return libkb.NaclDHKeyPair{}, nil, err
	}

	key, ok := naclSharedDHGen.GetKeyPair().(libkb.NaclDHKeyPair)
	if !ok {
		return libkb.NaclDHKeyPair{}, nil, errors.New("generated wrong type of sdh key")
	}
	if key.IsNil() {
		return libkb.NaclDHKeyPair{}, nil, errors.New("generated nil sdh key")
	}
	return key, naclSharedDHGen, nil
}

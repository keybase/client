// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
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
	deviceID  keybase1.DeviceID
	kid       keybase1.KID
	mode      RevokeMode
	forceSelf bool
	forceLast bool
}

type RevokeDeviceEngineArgs struct {
	ID        keybase1.DeviceID
	ForceSelf bool
	ForceLast bool
}

func NewRevokeDeviceEngine(args RevokeDeviceEngineArgs, g *libkb.GlobalContext) *RevokeEngine {
	return &RevokeEngine{
		deviceID:     args.ID,
		mode:         RevokeDevice,
		forceSelf:    args.ForceSelf,
		forceLast:    args.ForceLast,
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

func (e *RevokeEngine) explicitOrImplicitDeviceID(me *libkb.User) keybase1.DeviceID {
	if e.mode == RevokeDevice {
		return e.deviceID
	}
	for deviceID, device := range me.GetComputedKeyInfos().Devices {
		if device.Kid.Equal(e.kid) {
			return deviceID
		}
	}
	// If we're revoking a PGP key, it won't match any device.
	return ""
}

func (e *RevokeEngine) Run(ctx *Context) error {
	e.G().Log.CDebugf(ctx.NetContext, "RevokeEngine#Run (mode:%v)", e.mode)

	e.G().LocalSigchainGuard().Set(ctx.GetNetContext(), "RevokeEngine")
	defer e.G().LocalSigchainGuard().Clear(ctx.GetNetContext(), "RevokeEngine")

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		return err
	}

	currentDevice := e.G().Env.GetDeviceID()
	var deviceID keybase1.DeviceID
	if e.mode == RevokeDevice {
		deviceID = e.deviceID
		hasPGP := len(me.GetComputedKeyFamily().GetActivePGPKeys(false)) > 0

		if len(me.GetComputedKeyFamily().GetAllActiveDevices()) == 1 {
			if hasPGP {
				// even w/ forceLast, you cannot revoke your last device
				// if you have a pgp key
				return libkb.RevokeLastDevicePGPError{}
			}

			if !e.forceLast {
				return libkb.RevokeLastDeviceError{}
			}
		}

		if e.deviceID == currentDevice && !(e.forceSelf || e.forceLast) {
			return libkb.RevokeCurrentDeviceError{}
		}

	}

	kidsToRevoke, err := e.getKIDsToRevoke(me)
	if err != nil {
		return err
	}

	lease, merkleRoot, err := libkb.RequestDowngradeLeaseByKID(ctx.NetContext, e.G(), kidsToRevoke)
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

	if encKey == nil {
		return errors.New("Missing encryption key")
	}

	var pukBoxes []keybase1.PerUserKeyBox
	var pukPrev *libkb.PerUserKeyPrev

	// Whether this run is creating a new per-user-key. Set later.
	addingNewPUK := false

	// Only used if addingNewPUK
	var newPukGeneration keybase1.PerUserKeyGeneration
	var newPukSeed *libkb.PerUserKeySeed

	pukring, err := e.G().GetPerUserKeyring()
	if err != nil {
		return err
	}
	err = pukring.Sync(ctx.NetContext)
	if err != nil {
		return err
	}
	if pukring.HasAnyKeys() {
		addingNewPUK = true
		newPukGeneration = pukring.CurrentGeneration() + 1

		// Make a new per-user-key
		newPukSeedInner, err := libkb.GeneratePerUserKeySeed()
		if err != nil {
			return err
		}
		newPukSeed = &newPukSeedInner

		// Create a prev secretbox containing the previous generation seed
		pukPrevInner, err := pukring.PreparePrev(ctx.NetContext, *newPukSeed, newPukGeneration)
		if err != nil {
			return err
		}
		pukPrev = &pukPrevInner

		// Get the receivers who will be able to decrypt the new per-user-key
		pukReceivers, err := e.getPukReceivers(ctx, me, kidsToRevoke)
		if err != nil {
			return err
		}

		// Create boxes of the new per-user-key
		pukBoxesInner, err := pukring.PrepareBoxesForDevices(ctx.NetContext,
			*newPukSeed, newPukGeneration, pukReceivers, encKey)
		if err != nil {
			return err
		}
		pukBoxes = pukBoxesInner
	}

	var sigsList []libkb.JSONPayload

	// Push the per-user-key sig

	// Seqno when the per-user-key will be signed in.
	var newPukSeqno keybase1.Seqno
	if addingNewPUK {
		sig1, err := libkb.PerUserKeyProofReverseSigned(me, *newPukSeed, newPukGeneration, sigKey)
		if err != nil {
			return err
		}
		newPukSeqno = me.GetSigChainLastKnownSeqno()
		sigsList = append(sigsList, sig1)
	}

	// Push the revoke sig
	sig2, err := e.makeRevokeSig(ctx, me, sigKey, kidsToRevoke, deviceID, merkleRoot)
	if err != nil {
		return err
	}
	sigsList = append(sigsList, sig2)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList
	payload["downgrade_lease_id"] = lease.LeaseID

	e.G().Log.CDebugf(ctx.NetContext, "RevokeEngine#Run pukBoxes:%v pukPrev:%v for generation %v",
		len(pukBoxes), pukPrev != nil, newPukGeneration)
	if addingNewPUK {
		libkb.AddPerUserKeyServerArg(payload, newPukGeneration, pukBoxes, pukPrev)
	}

	ekLib := e.G().GetEKLib()
	var myUserEKBox *keybase1.UserEkBoxed
	var newUserEKMetadata *keybase1.UserEkMetadata
	if addingNewPUK && ekLib != nil && ekLib.ShouldRun(ctx.NetContext) {
		sig, boxes, newMetadata, myBox, err := ekLib.PrepareNewUserEK(ctx.NetContext, *merkleRoot, *newPukSeed)
		if err != nil {
			return err
		}
		// The assembled set of boxes includes one for the device we're in the
		// middle of revoking. Filter it out.
		filteredBoxes := []keybase1.UserEkBoxMetadata{}
		deviceIDToFilter := e.explicitOrImplicitDeviceID(me)
		for _, boxMetadata := range boxes {
			if !boxMetadata.RecipientDeviceID.Eq(deviceIDToFilter) {
				filteredBoxes = append(filteredBoxes, boxMetadata)
			}
		}
		// If there are no active deviceEKs, we can't publish this key. This
		// should mostly only come up in tests.
		if len(filteredBoxes) > 0 {
			myUserEKBox = myBox
			newUserEKMetadata = &newMetadata
			userEKSection := make(libkb.JSONPayload)
			userEKSection["sig"] = sig
			userEKSection["boxes"] = filteredBoxes
			payload["user_ek"] = userEKSection
		} else {
			e.G().Log.CWarningf(ctx.NetContext, "skipping userEK publishing, because there are no valid deviceEKs")
		}
	}

	_, err = e.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}

	if addingNewPUK {
		err = pukring.AddKey(ctx.NetContext, newPukGeneration, newPukSeqno, *newPukSeed)
		if err != nil {
			return err
		}
	}

	// Add the new userEK box to local storage, if it was created above.
	if myUserEKBox != nil {
		err = e.G().GetUserEKBoxStorage().Put(ctx.NetContext, newUserEKMetadata.Generation, *myUserEKBox)
		if err != nil {
			e.G().Log.CErrorf(ctx.NetContext, "error while saving userEK box: %s", err)
		}
	}

	e.G().UserChanged(me.GetUID())

	return nil
}

// Get the full keys for this device.
// Returns (sigKey, encKey, err)
func (e *RevokeEngine) getDeviceSecretKeys(ctx *Context, me *libkb.User) (libkb.GenericKey, libkb.GenericKey, error) {
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

	skaEnc := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceEncryptionKeyType,
	}
	encKey, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(skaEnc, "to revoke another key"))
	if err != nil {
		return nil, nil, err
	}
	if err = encKey.CheckSecretKey(); err != nil {
		return nil, nil, err
	}

	return sigKey, encKey, err
}

func (e *RevokeEngine) makeRevokeSig(ctx *Context, me *libkb.User, sigKey libkb.GenericKey,
	kidsToRevoke []keybase1.KID, deviceID keybase1.DeviceID, merkleRoot *libkb.MerkleRoot) (libkb.JSONPayload, error) {

	proof, err := me.RevokeKeysProof(sigKey, kidsToRevoke, deviceID, merkleRoot)
	if err != nil {
		return nil, err
	}
	sig, _, _, err := libkb.SignJSON(proof, sigKey)
	if err != nil {
		return nil, err
	}

	sig1 := make(libkb.JSONPayload)
	sig1["sig"] = sig
	sig1["signing_kid"] = sigKey.GetKID().String()
	sig1["type"] = libkb.LinkTypeRevoke
	return sig1, nil
}

// Get the receivers of the new per-user-key boxes.
// Includes all device subkeys except any being revoked by this engine.
func (e *RevokeEngine) getPukReceivers(ctx *Context, me *libkb.User, exclude []keybase1.KID) (res []libkb.NaclDHKeyPair, err error) {
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

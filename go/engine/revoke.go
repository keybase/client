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
	deviceID             keybase1.DeviceID
	kid                  keybase1.KID
	mode                 RevokeMode
	forceSelf            bool
	forceLast            bool
	skipUserEKForTesting bool // Set for testing
}

type RevokeDeviceEngineArgs struct {
	ID                   keybase1.DeviceID
	ForceSelf            bool
	ForceLast            bool
	SkipUserEKForTesting bool
}

func NewRevokeDeviceEngine(g *libkb.GlobalContext, args RevokeDeviceEngineArgs) *RevokeEngine {
	return &RevokeEngine{
		deviceID:             args.ID,
		mode:                 RevokeDevice,
		forceSelf:            args.ForceSelf,
		forceLast:            args.ForceLast,
		skipUserEKForTesting: args.SkipUserEKForTesting,
		Contextified:         libkb.NewContextified(g),
	}
}

func NewRevokeKeyEngine(g *libkb.GlobalContext, kid keybase1.KID) *RevokeEngine {
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

func (e *RevokeEngine) Run(m libkb.MetaContext) error {
	m.Debug("RevokeEngine#Run (mode:%v)", e.mode)

	e.G().LocalSigchainGuard().Set(m.Ctx(), "RevokeEngine")
	defer e.G().LocalSigchainGuard().Clear(m.Ctx(), "RevokeEngine")

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	if err != nil {
		return err
	}

	currentDevice := m.G().Env.GetDeviceID()
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

	lease, merkleRoot, err := libkb.RequestDowngradeLeaseByKID(m.Ctx(), m.G(), kidsToRevoke)
	if err != nil {
		return err
	}

	m.UIs().LogUI.Info("Revoking KIDs:")
	for _, kid := range kidsToRevoke {
		m.UIs().LogUI.Info("  %s", kid)
	}

	sigKey, encKey, err := e.getDeviceSecretKeys(m, me)
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

	pukring, err := e.G().GetPerUserKeyring(m.Ctx())
	if err != nil {
		return err
	}
	err = pukring.Sync(m)
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
		pukPrevInner, err := pukring.PreparePrev(m, *newPukSeed, newPukGeneration)
		if err != nil {
			return err
		}
		pukPrev = &pukPrevInner

		// Get the receivers who will be able to decrypt the new per-user-key
		pukReceivers, err := e.getPukReceivers(m, me, kidsToRevoke)
		if err != nil {
			return err
		}

		// Create boxes of the new per-user-key
		pukBoxesInner, err := pukring.PrepareBoxesForDevices(m,
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
		sig1, err := libkb.PerUserKeyProofReverseSigned(m, me, *newPukSeed, newPukGeneration, sigKey)
		if err != nil {
			return err
		}
		newPukSeqno = me.GetSigChainLastKnownSeqno()
		sigsList = append(sigsList, sig1.Payload)
	}

	// Push the revoke sig
	sig2, lastSeqno, lastLinkID, err := e.makeRevokeSig(m, me, sigKey, kidsToRevoke, deviceID, merkleRoot)
	if err != nil {
		return err
	}
	sigsList = append(sigsList, sig2)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList
	payload["downgrade_lease_id"] = lease.LeaseID

	if addingNewPUK {
		libkb.AddPerUserKeyServerArg(payload, newPukGeneration, pukBoxes, pukPrev)
	}

	var myUserEKBox *keybase1.UserEkBoxed
	var newUserEKMetadata *keybase1.UserEkMetadata
	ekLib := e.G().GetEKLib()
	if !e.skipUserEKForTesting && addingNewPUK && ekLib != nil {
		sig, boxes, newMetadata, myBox, err := ekLib.PrepareNewUserEK(m, *merkleRoot, *newPukSeed)
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
			m.Debug("skipping userEK publishing, there are no valid deviceEKs")
		}
	}
	m.Debug("RevokeEngine#Run pukBoxes:%v pukPrev:%v for generation %v, userEKBox: %v",
		len(pukBoxes), pukPrev != nil, newPukGeneration, myUserEKBox != nil)

	_, err = m.G().API.PostJSON(m, libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		// Revoke failed, let's clear downgrade lease so it will not prevent us
		// from trying again for given kids.
		err2 := libkb.CancelDowngradeLease(m.Ctx(), m.G(), lease.LeaseID)
		if err2 != nil {
			m.Warning("Failed to cancel downgrade leases after a failed revoke: %s", err2)
			return libkb.CombineErrors(err, err2)
		}
		return err
	}
	if err = libkb.MerkleCheckPostedUserSig(m, me.GetUID(), lastSeqno, lastLinkID); err != nil {
		return err
	}

	if addingNewPUK {
		err = pukring.AddKey(m, newPukGeneration, newPukSeqno, *newPukSeed)
		if err != nil {
			return err
		}
	}

	// Add the new userEK box to local storage, if it was created above.
	if myUserEKBox != nil {
		err = e.G().GetUserEKBoxStorage().Put(m, newUserEKMetadata.Generation, *myUserEKBox)
		if err != nil {
			m.Warning("error while saving userEK box: %s", err)
		}
	}

	e.G().UserChanged(m.Ctx(), me.GetUID())

	return nil
}

// Get the full keys for this device.
// Returns (sigKey, encKey, err)
func (e *RevokeEngine) getDeviceSecretKeys(m libkb.MetaContext, me *libkb.User) (libkb.GenericKey, libkb.GenericKey, error) {
	skaSig := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	sigKey, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(skaSig, "to revoke another key"))
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
	encKey, err := m.G().Keyrings.GetSecretKeyWithPrompt(m, m.SecretKeyPromptArg(skaEnc, "to revoke another key"))
	if err != nil {
		return nil, nil, err
	}
	if err = encKey.CheckSecretKey(); err != nil {
		return nil, nil, err
	}

	return sigKey, encKey, err
}

func (e *RevokeEngine) makeRevokeSig(m libkb.MetaContext, me *libkb.User, sigKey libkb.GenericKey,
	kidsToRevoke []keybase1.KID, deviceID keybase1.DeviceID,
	merkleRoot *libkb.MerkleRoot) (libkb.JSONPayload, keybase1.Seqno, libkb.LinkID, error) {
	proof, err := me.RevokeKeysProof(m, sigKey, kidsToRevoke, deviceID, merkleRoot)
	if err != nil {
		return nil, 0, nil, err
	}
	sig, _, linkID, err := libkb.SignJSON(proof.J, sigKey)
	if err != nil {
		return nil, 0, nil, err
	}

	sig1 := make(libkb.JSONPayload)
	sig1["sig"] = sig
	sig1["signing_kid"] = sigKey.GetKID().String()
	sig1["type"] = libkb.LinkTypeRevoke
	return sig1, proof.Seqno, linkID, nil
}

// Get the receivers of the new per-user-key boxes.
// Includes all device subkeys except any being revoked by this engine.
func (e *RevokeEngine) getPukReceivers(m libkb.MetaContext, me *libkb.User, exclude []keybase1.KID) (res []libkb.NaclDHKeyPair, err error) {
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

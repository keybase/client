// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// PerUserKeyRoll creates a new per-user-key for the active user.
// This can be the first per-user-key for the user.
package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// PerUserKeyRoll is an engine.
type PerUserKeyRoll struct {
	libkb.Contextified
	args      *PerUserKeyRollArgs
	DidNewKey bool
}

type PerUserKeyRollArgs struct {
	Me *libkb.User // optional
}

// NewPerUserKeyRoll creates a PerUserKeyRoll engine.
func NewPerUserKeyRoll(g *libkb.GlobalContext, args *PerUserKeyRollArgs) *PerUserKeyRoll {
	return &PerUserKeyRoll{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PerUserKeyRoll) Name() string {
	return "PerUserKeyRoll"
}

// GetPrereqs returns the engine prereqs.
func (e *PerUserKeyRoll) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PerUserKeyRoll) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PerUserKeyRoll) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
func (e *PerUserKeyRoll) Run(m libkb.MetaContext) (err error) {
	defer m.CTrace("PerUserKeyRoll", func() error { return err })()
	return e.inner(m)
}

func (e *PerUserKeyRoll) inner(m libkb.MetaContext) error {
	var err error

	uid := m.G().GetMyUID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}

	me := e.args.Me
	if me == nil {
		m.CDebugf("PerUserKeyRoll load self")

		loadArg := libkb.NewLoadUserArgWithMetaContext(m).
			WithUID(uid).
			WithSelf(true).
			WithPublicKeyOptional()
		me, err = libkb.LoadUser(loadArg)
		if err != nil {
			return err
		}
	}
	meUPAK := me.ExportToUserPlusAllKeys()

	sigKey, err := m.ActiveDevice().SigningKey()
	if err != nil {
		return fmt.Errorf("signing key not found: (%v)", err)
	}
	encKey, err := m.ActiveDevice().EncryptionKey()
	if err != nil {
		return fmt.Errorf("encryption key not found: (%v)", err)
	}

	pukring, err := m.G().GetPerUserKeyring()
	if err != nil {
		return err
	}
	err = pukring.Sync(m)
	if err != nil {
		return err
	}

	// Generation of the new key
	gen := pukring.CurrentGeneration() + keybase1.PerUserKeyGeneration(1)
	m.CDebugf("PerUserKeyRoll creating gen: %v", gen)

	pukSeed, err := libkb.GeneratePerUserKeySeed()
	if err != nil {
		return err
	}

	var pukPrev *libkb.PerUserKeyPrev
	if gen > 1 {
		pukPrevInner, err := pukring.PreparePrev(m, pukSeed, gen)
		if err != nil {
			return err
		}
		pukPrev = &pukPrevInner
	}

	pukReceivers, err := e.getPukReceivers(m, &meUPAK)
	if err != nil {
		return err
	}
	if len(pukReceivers) == 0 {
		return fmt.Errorf("no receivers")
	}

	// Create boxes of the new per-user-key
	pukBoxes, err := pukring.PrepareBoxesForDevices(m,
		pukSeed, gen, pukReceivers, encKey)
	if err != nil {
		return err
	}

	m.CDebugf("PerUserKeyRoll make sigs")
	sig, err := libkb.PerUserKeyProofReverseSigned(me, pukSeed, gen, sigKey)
	if err != nil {
		return err
	}
	// Seqno when the per-user-key will be signed in.
	pukSeqno := me.GetSigChainLastKnownSeqno()

	var sigsList []libkb.JSONPayload
	sigsList = append(sigsList, sig)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList

	m.CDebugf("PerUserKeyRoll pukBoxes:%v pukPrev:%v for generation %v",
		len(pukBoxes), pukPrev != nil, gen)
	libkb.AddPerUserKeyServerArg(payload, gen, pukBoxes, pukPrev)

	ekLib := m.G().GetEKLib()
	var myUserEKBox *keybase1.UserEkBoxed
	var newUserEKMetadata *keybase1.UserEkMetadata
	if ekLib != nil {
		merkleRoot, err := m.G().GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
		if err != nil {
			return err
		}
		sig, boxes, newMetadata, myBox, err := ekLib.PrepareNewUserEK(m.Ctx(), *merkleRoot, pukSeed)
		if err != nil {
			return err
		}
		// If there are no active deviceEKs, we can't publish this key. This
		// should mostly only come up in tests.
		if len(boxes) > 0 {
			myUserEKBox = myBox
			newUserEKMetadata = &newMetadata
			userEKSection := make(libkb.JSONPayload)
			userEKSection["sig"] = sig
			userEKSection["boxes"] = boxes
			payload["user_ek"] = userEKSection
		} else {
			m.CDebugf("skipping userEK publishing, there are no valid deviceEKs")
		}
	}

	m.CDebugf("PerUserKeyRoll post")
	_, err = m.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
		NetContext:  m.Ctx(),
	})
	if err != nil {
		return err
	}
	e.DidNewKey = true

	// Add the per-user-key locally
	err = pukring.AddKey(m, gen, pukSeqno, pukSeed)
	if err != nil {
		return err
	}

	// Add the new userEK box to local storage, if it was created above.
	if myUserEKBox != nil {
		err = m.G().GetUserEKBoxStorage().Put(m.Ctx(), newUserEKMetadata.Generation, *myUserEKBox)
		if err != nil {
			m.CErrorf("error while saving userEK box: %s", err)
		}
	}

	m.G().UserChanged(uid)
	return nil
}

// Get the receivers of the new per-user-key boxes.
// Includes all the user's device subkeys.
func (e *PerUserKeyRoll) getPukReceivers(m libkb.MetaContext, meUPAK *keybase1.UserPlusAllKeys) (res []libkb.NaclDHKeyPair, err error) {
	for _, dk := range meUPAK.Base.DeviceKeys {
		if dk.IsSibkey == false && !dk.IsRevoked {
			receiver, err := libkb.ImportNaclDHKeyPairFromHex(dk.KID.String())
			if err != nil {
				return res, err
			}
			res = append(res, receiver)
		}
	}
	return res, nil
}

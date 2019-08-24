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
func (e *PerUserKeyRoll) Run(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("PerUserKeyRoll", func() error { return err })()
	return e.inner(mctx)
}

func (e *PerUserKeyRoll) inner(mctx libkb.MetaContext) error {
	var err error

	uid := mctx.G().GetMyUID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}

	me := e.args.Me
	if me == nil {
		mctx.Debug("PerUserKeyRoll load self")

		loadArg := libkb.NewLoadUserArgWithMetaContext(mctx).
			WithUID(uid).
			WithSelf(true).
			WithPublicKeyOptional()
		me, err = libkb.LoadUser(loadArg)
		if err != nil {
			return err
		}
	}
	meUPAK := me.ExportToUserPlusAllKeys()

	sigKey, err := mctx.ActiveDevice().SigningKey()
	if err != nil {
		return fmt.Errorf("signing key not found: (%v)", err)
	}
	encKey, err := mctx.ActiveDevice().EncryptionKey()
	if err != nil {
		return fmt.Errorf("encryption key not found: (%v)", err)
	}

	pukring, err := mctx.G().GetPerUserKeyring(mctx.Ctx())
	if err != nil {
		return err
	}
	err = pukring.Sync(mctx)
	if err != nil {
		return err
	}

	// Generation of the new key
	gen := pukring.CurrentGeneration() + keybase1.PerUserKeyGeneration(1)
	mctx.Debug("PerUserKeyRoll creating gen: %v", gen)

	pukSeed, err := libkb.GeneratePerUserKeySeed()
	if err != nil {
		return err
	}

	var pukPrev *libkb.PerUserKeyPrev
	if gen > 1 {
		pukPrevInner, err := pukring.PreparePrev(mctx, pukSeed, gen)
		if err != nil {
			return err
		}
		pukPrev = &pukPrevInner
	}

	pukReceivers, err := e.getPukReceivers(mctx, &meUPAK)
	if err != nil {
		return err
	}
	if len(pukReceivers) == 0 {
		return fmt.Errorf("no receivers")
	}

	// Create boxes of the new per-user-key
	pukBoxes, err := pukring.PrepareBoxesForDevices(mctx,
		pukSeed, gen, pukReceivers, encKey)
	if err != nil {
		return err
	}

	mctx.Debug("PerUserKeyRoll make sigs")
	sig, err := libkb.PerUserKeyProofReverseSigned(mctx, me, pukSeed, gen, sigKey)
	if err != nil {
		return err
	}
	// Seqno when the per-user-key will be signed in.
	pukSeqno := sig.Seqno

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []libkb.JSONPayload{sig.Payload}

	mctx.Debug("PerUserKeyRoll pukBoxes:%v pukPrev:%v for generation %v",
		len(pukBoxes), pukPrev != nil, gen)
	libkb.AddPerUserKeyServerArg(payload, gen, pukBoxes, pukPrev)

	ekLib := mctx.G().GetEKLib()
	var myUserEKBox *keybase1.UserEkBoxed
	var newUserEKMetadata *keybase1.UserEkMetadata
	if ekLib != nil {
		merkleRoot, err := mctx.G().GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
		if err != nil {
			return err
		}
		sig, boxes, newMetadata, myBox, err := ekLib.PrepareNewUserEK(mctx, *merkleRoot, pukSeed)
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
			mctx.Debug("skipping userEK publishing, there are no valid deviceEKs")
		}
	}

	mctx.Debug("PerUserKeyRoll post")
	_, err = mctx.G().API.PostJSON(mctx, libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}
	if err = libkb.MerkleCheckPostedUserSig(mctx, uid, pukSeqno, sig.LinkID); err != nil {
		return err
	}
	e.DidNewKey = true

	// Add the per-user-key locally
	err = pukring.AddKey(mctx, gen, pukSeqno, pukSeed)
	if err != nil {
		return err
	}

	// Add the new userEK box to local storage, if it was created above.
	if myUserEKBox != nil {
		err = mctx.G().GetUserEKBoxStorage().Put(mctx, newUserEKMetadata.Generation, *myUserEKBox)
		if err != nil {
			mctx.Error("error while saving userEK box: %s", err)
		}
	}

	mctx.G().UserChanged(mctx.Ctx(), uid)
	return nil
}

// Get the receivers of the new per-user-key boxes.
// Includes all the user's device subkeys.
func (e *PerUserKeyRoll) getPukReceivers(mctx libkb.MetaContext, meUPAK *keybase1.UserPlusAllKeys) (res []libkb.NaclDHKeyPair, err error) {
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

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
func (e *PerUserKeyRoll) Run(ctx *Context) (err error) {
	defer e.G().CTrace(ctx.GetNetContext(), "PerUserKeyRoll", func() error { return err })()
	return e.inner(ctx)
}

func (e *PerUserKeyRoll) inner(ctx *Context) error {
	var err error

	uid := e.G().GetMyUID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}

	me := e.args.Me
	if me == nil {
		e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyRoll load self")

		loadArg := libkb.NewLoadUserArgBase(e.G()).
			WithNetContext(ctx.GetNetContext()).
			WithUID(uid).
			WithSelf(true).
			WithPublicKeyOptional()
		me, err = libkb.LoadUser(*loadArg)
		if err != nil {
			return err
		}
	}
	meUPAK := me.ExportToUserPlusAllKeys()

	sigKey, err := e.G().ActiveDevice.SigningKey()
	if err != nil {
		return fmt.Errorf("signing key not found: (%v)", err)
	}
	encKey, err := e.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return fmt.Errorf("encryption key not found: (%v)", err)
	}

	pukring, err := e.G().GetPerUserKeyring()
	if err != nil {
		return err
	}
	err = pukring.Sync(ctx.GetNetContext())
	if err != nil {
		return err
	}

	// Generation of the new key
	gen := pukring.CurrentGeneration() + keybase1.PerUserKeyGeneration(1)
	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyRoll creating gen: %v", gen)

	pukSeed, err := libkb.GeneratePerUserKeySeed()
	if err != nil {
		return err
	}

	var pukPrev *libkb.PerUserKeyPrev
	if gen > 1 {
		pukPrevInner, err := pukring.PreparePrev(ctx.GetNetContext(), pukSeed, gen)
		if err != nil {
			return err
		}
		pukPrev = &pukPrevInner
	}

	pukReceivers, err := e.getPukReceivers(ctx, &meUPAK)
	if err != nil {
		return err
	}
	if len(pukReceivers) == 0 {
		return fmt.Errorf("no receivers")
	}

	// Create boxes of the new per-user-key
	pukBoxes, err := pukring.PrepareBoxesForDevices(ctx.GetNetContext(),
		pukSeed, gen, pukReceivers, encKey)
	if err != nil {
		return err
	}

	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyRoll make sigs")
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

	e.G().Log.CDebugf(ctx.NetContext, "PerUserKeyRoll pukBoxes:%v pukPrev:%v for generation %v",
		len(pukBoxes), pukPrev != nil, gen)
	libkb.AddPerUserKeyServerArg(payload, gen, pukBoxes, pukPrev)

	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyRoll post")
	_, err = e.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}
	e.DidNewKey = true

	// Add the per-user-key locally
	err = pukring.AddKey(ctx.GetNetContext(), gen, pukSeqno, pukSeed)
	if err != nil {
		return err
	}

	e.G().UserChanged(uid)
	return nil
}

// Get the receivers of the new per-user-key boxes.
// Includes all the user's device subkeys.
func (e *PerUserKeyRoll) getPukReceivers(ctx *Context, meUPAK *keybase1.UserPlusAllKeys) (res []libkb.NaclDHKeyPair, err error) {
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

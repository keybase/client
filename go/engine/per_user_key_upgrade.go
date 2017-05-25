// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// PerUserKeyUpgrade creates a per-user-key for the active user
// if they do not already have one.
// It adds a per-user-key link to the sigchain and adds the key to the local keyring.
package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// PerUserKeyUpgrade is an engine.
type PerUserKeyUpgrade struct {
	libkb.Contextified
	args      *PerUserKeyUpgradeArgs
	DidNewKey bool
}

type PerUserKeyUpgradeArgs struct {
	LoginContext libkb.LoginContext // optional
}

// NewPerUserKeyUpgrade creates a PerUserKeyUpgrade engine.
func NewPerUserKeyUpgrade(g *libkb.GlobalContext, args *PerUserKeyUpgradeArgs) *PerUserKeyUpgrade {
	return &PerUserKeyUpgrade{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *PerUserKeyUpgrade) Name() string {
	return "PerUserKeyUpgrade"
}

// GetPrereqs returns the engine prereqs.
func (e *PerUserKeyUpgrade) Prereqs() Prereqs {
	return Prereqs{
		Session: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *PerUserKeyUpgrade) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PerUserKeyUpgrade) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{&PaperKeyGen{}}
}

// Run starts the engine.
func (e *PerUserKeyUpgrade) Run(ctx *Context) (err error) {
	defer e.G().CTrace(ctx.GetNetContext(), "PerUserKeyUpgrade", func() error { return err })()
	return e.inner(ctx)
}

func (e *PerUserKeyUpgrade) inner(ctx *Context) error {
	if !e.G().Env.GetUpgradePerUserKey() {
		return fmt.Errorf("per-user-key upgrade is disabled")
	}

	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpgrade load self")

	uid := e.G().GetMyUID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}

	loadArg := libkb.NewLoadUserArgBase(e.G()).WithNetContext(ctx.GetNetContext()).WithUID(uid).WithPublicKeyOptional()
	loadArg.LoginContext = e.args.LoginContext
	upak, me, err := e.G().GetUPAKLoader().Load(*loadArg)
	if err != nil {
		return err
	}

	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpgrade check for key")
	if len(upak.Base.PerUserKeys) > 0 {
		e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpgrade already has per-user-key")
		e.DidNewKey = false
		return nil
	}
	e.G().Log.CDebugf(ctx.GetNetContext(), "PerUserKeyUpgrade has no per-user-key")

	sigKey, err := e.G().ActiveDevice.SigningKey()
	if err != nil {
		return err
	}
	encKey, err := e.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return err
	}

	pukring, err := e.G().GetPerUserKeyring()
	if err != nil {
		return err
	}
	err = pukring.Sync(ctx.GetNetContext())
	if err != nil {
		return err
	}

	gen1 := keybase1.PerUserKeyGeneration(1)

	pukSeed, err := libkb.GeneratePerUserKeySeed()
	if err != nil {
		return err
	}

	pukReceivers, err := e.getPukReceivers(ctx, upak)
	if err != nil {
		return err
	}
	if len(pukReceivers) == 0 {
		return fmt.Errorf("no receivers")
	}

	// Create boxes of the new per-user-key
	pukBoxes, err := pukring.PrepareBoxesForDevices(ctx.GetNetContext(),
		pukSeed, gen1, pukReceivers, encKey)
	if err != nil {
		return err
	}

	sig1, err := libkb.PerUserKeyProofReverseSigned(me, pukSeed, gen1, sigKey)
	if err != nil {
		return err
	}

	var sigsList []libkb.JSONPayload
	sigsList = append(sigsList, sig1)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList

	libkb.AddPerUserKeyServerArg(payload, gen1, pukBoxes, nil)

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
	err = pukring.AddKey(ctx.GetNetContext(), gen1, pukSeed)
	if err != nil {
		return err
	}

	e.G().UserChanged(uid)
	return nil
}

// Get the receivers of the new per-user-key boxes.
// Includes all the user's device subkeys.
func (e *PerUserKeyUpgrade) getPukReceivers(ctx *Context, meUPAK *keybase1.UserPlusAllKeys) (res []libkb.NaclDHKeyPair, err error) {
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

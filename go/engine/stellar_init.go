// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// StellarInit creates an initial stellar bundle for a user
// if they do not already have one.
// Safe to call even if the user has a bundle already.
package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	stellarbundle "github.com/keybase/client/go/stellar/bundle"
)

// StellarInit is an engine.
type StellarInit struct {
	libkb.Contextified
	DidCreateBundle bool
}

// NewStellarInit creates a StellarInit engine.
func NewStellarInit(g *libkb.GlobalContext) *StellarInit {
	return &StellarInit{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *StellarInit) Name() string {
	return "StellarInit"
}

// GetPrereqs returns the engine prereqs.
func (e *StellarInit) Prereqs() Prereqs {
	return Prereqs{
		Device: true,
	}
}

// RequiredUIs returns the required UIs.
func (e *StellarInit) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *StellarInit) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
func (e *StellarInit) Run(ctx *Context) (err error) {
	defer e.G().CTrace(ctx.GetNetContext(), "StellarInit", func() error { return err })()
	return e.inner(ctx)
}

func (e *StellarInit) inner(ctx *Context) error {
	var err error

	uid := e.G().GetMyUID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}

	e.G().Log.CDebugf(ctx.GetNetContext(), "StellarInit load self")
	loadMeArg := libkb.NewLoadUserArg(e.G()).
		WithNetContext(ctx.GetNetContext()).
		WithUID(uid).
		WithSelf(true).
		WithPublicKeyOptional()
	me, err := libkb.LoadUser(loadMeArg)
	if err != nil {
		return err
	}

	// TODO: short-circuit if the user has a bundle already

	sigKey, err := e.G().ActiveDevice.SigningKey()
	if err != nil {
		return fmt.Errorf("signing key not found: (%v)", err)
	}
	pukring, err := e.G().GetPerUserKeyring()
	if err != nil {
		return err
	}
	err = pukring.Sync(ctx.GetNetContext())
	if err != nil {
		return err
	}
	pukGen := pukring.CurrentGeneration()
	pukSeed, err := pukring.GetSeedByGeneration(ctx.GetNetContext(), pukGen)
	if err != nil {
		return err
	}

	clearBundle, err := stellarbundle.NewInitialBundle()
	if err != nil {
		return err
	}
	if len(clearBundle.Accounts) < 1 {
		return errors.New("stellar bundle has no accounts")
	}
	stellarAccount := clearBundle.Accounts[0]
	if len(stellarAccount.Signers) < 1 {
		return errors.New("stellar bundle has no signers")
	}
	if !stellarAccount.IsPrimary {
		return errors.New("initial stellar account is not primary")
	}
	e.G().Log.CDebugf(ctx.NetContext, "StellarInit accountID:%v pukGen:%v", stellarAccount.AccountID, pukGen)
	boxed, err := stellarbundle.Box(clearBundle, pukGen, pukSeed)
	if err != nil {
		return err
	}

	e.G().Log.CDebugf(ctx.GetNetContext(), "StellarInit make sigs")

	sig, err := libkb.WalletProofReverseSigned(me, stellarAccount.AccountID, stellarAccount.Signers[0], sigKey)
	if err != nil {
		return err
	}

	var sigsList []libkb.JSONPayload
	sigsList = append(sigsList, sig)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList

	libkb.AddWalletServerArg(payload, boxed.EncB64, boxed.VisB64, int(boxed.FormatVersion))

	e.G().Log.CDebugf(ctx.GetNetContext(), "StellarInit post")
	_, err = e.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}
	e.DidCreateBundle = true

	e.G().UserChanged(uid)
	return nil
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type NaclKeyPair interface {
	GenericKey
}

type NaclGenerator func() (NaclKeyPair, error)

type NaclKeyGenArg struct {
	Signer         GenericKey // who is going to sign us into the Chain
	ExpiresIn      int
	Generator      NaclGenerator
	Me             *User
	DelegationType DelegationType
	ExpireIn       int          // how long it lasts
	EldestKeyID    keybase1.KID // the eldest KID for this epoch
	Device         *Device
	RevSig         string // optional reverse sig.  set to nil for autogenerate.
}

type NaclKeyGen struct {
	arg  *NaclKeyGenArg
	pair NaclKeyPair
}

func NewNaclKeyGen(arg NaclKeyGenArg) *NaclKeyGen {
	return &NaclKeyGen{arg: &arg}
}

func (g *NaclKeyGen) Generate() (err error) {
	g.pair, err = g.arg.Generator()
	return
}

func (g *NaclKeyGen) SaveLKS(gc *GlobalContext, lks *LKSec, lctx LoginContext) error {
	_, err := WriteLksSKBToKeyring(gc, g.pair, lks, lctx)
	return err
}

func (g *NaclKeyGen) Push(lctx LoginContext, aggregated bool) (d Delegator, err error) {
	if g.pair == nil {
		return Delegator{}, fmt.Errorf("cannot Push delegator before Generate")
	}
	d = Delegator{
		NewKey:         g.pair,
		RevSig:         g.arg.RevSig,
		Device:         g.arg.Device,
		Expire:         g.arg.ExpireIn,
		DelegationType: g.arg.DelegationType,
		ExistingKey:    g.arg.Signer,
		Me:             g.arg.Me,
		EldestKID:      g.arg.EldestKeyID,
	}

	if aggregated {
		return
	}

	err = d.Run(lctx)
	return
}

func (g *NaclKeyGen) GetKeyPair() NaclKeyPair {
	return g.pair
}

func (g *NaclKeyGen) UpdateArg(signer GenericKey, eldestKID keybase1.KID, delegationType DelegationType, user *User) {
	g.arg.Signer = signer
	g.arg.EldestKeyID = eldestKID
	g.arg.DelegationType = delegationType
	// if a user is passed in, then update the user pointer
	// this is necessary if the sigchain changed between generation and push.
	if user != nil {
		g.arg.Me = user
	}
}

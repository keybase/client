// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// DeviceWrap is an engine that wraps DeviceRegister and
// DeviceKeygen.
type DeviceWrap struct {
	libkb.Contextified

	args *DeviceWrapArgs

	signingKey    libkb.GenericKey
	encryptionKey libkb.NaclDHKeyPair
	sharedDHKey   libkb.GenericKey // can be nil
}

type DeviceWrapArgs struct {
	Me              *libkb.User
	DeviceName      string
	DeviceType      string
	Lks             *libkb.LKSec
	IsEldest        bool
	Signer          libkb.GenericKey
	EldestKID       keybase1.KID
	SharedDHKeyring *libkb.SharedDHKeyring // optional in some cases
}

// NewDeviceWrap creates a DeviceWrap engine.
func NewDeviceWrap(args *DeviceWrapArgs, g *libkb.GlobalContext) *DeviceWrap {
	return &DeviceWrap{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *DeviceWrap) Name() string {
	return "DeviceWrap"
}

// GetPrereqs returns the engine prereqs.
func (e *DeviceWrap) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *DeviceWrap) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DeviceWrap) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&DeviceRegister{},
		&DeviceKeygen{},
	}
}

// Run starts the engine.
func (e *DeviceWrap) Run(ctx *Context) error {
	regArgs := &DeviceRegisterArgs{
		Me:   e.args.Me,
		Name: e.args.DeviceName,
		Lks:  e.args.Lks,
	}
	regEng := NewDeviceRegister(regArgs, e.G())
	if err := RunEngine(regEng, ctx); err != nil {
		return err
	}

	deviceID := regEng.DeviceID()

	kgArgs := &DeviceKeygenArgs{
		Me:              e.args.Me,
		DeviceID:        deviceID,
		DeviceName:      e.args.DeviceName,
		DeviceType:      e.args.DeviceType,
		Lks:             e.args.Lks,
		IsEldest:        e.args.IsEldest,
		SharedDHKeyring: e.args.SharedDHKeyring,
	}
	kgEng := NewDeviceKeygen(kgArgs, e.G())
	if err := RunEngine(kgEng, ctx); err != nil {
		return err
	}

	pargs := &DeviceKeygenPushArgs{
		Signer:    e.args.Signer,
		EldestKID: e.args.EldestKID,
	}
	if err := kgEng.Push(ctx, pargs); err != nil {
		return err
	}

	e.signingKey = kgEng.SigningKey()
	e.encryptionKey = kgEng.EncryptionKey()
	// TODO get the shared dh key and save it if it was generated

	if ctx.LoginContext != nil {
		// cache the secret keys
		ctx.LoginContext.SetCachedSecretKey(libkb.SecretKeyArg{KeyType: libkb.DeviceSigningKeyType}, e.signingKey)
		ctx.LoginContext.SetCachedSecretKey(libkb.SecretKeyArg{KeyType: libkb.DeviceEncryptionKeyType}, e.encryptionKey)
	}

	return nil
}

func (e *DeviceWrap) SigningKey() libkb.GenericKey {
	return e.signingKey
}

func (e *DeviceWrap) EncryptionKey() libkb.NaclDHKeyPair {
	return e.encryptionKey
}

func (e *DeviceWrap) SharedDHKey() (libkb.GenericKey, error) {
	if e.sharedDHKey == nil {
		return nil, fmt.Errorf("DeviceWrap: no shared DH key")
	}
	return e.sharedDHKey, nil
}

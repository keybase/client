// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
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
}

type DeviceWrapArgs struct {
	Me             *libkb.User
	DeviceName     string
	DeviceType     string
	Lks            *libkb.LKSec
	IsEldest       bool
	Signer         libkb.GenericKey
	EldestKID      keybase1.KID
	PerUserKeyring *libkb.PerUserKeyring
}

// NewDeviceWrap creates a DeviceWrap engine.
func NewDeviceWrap(g *libkb.GlobalContext, args *DeviceWrapArgs) *DeviceWrap {
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
func (e *DeviceWrap) Run(m libkb.MetaContext) (err error) {
	regArgs := &DeviceRegisterArgs{
		Me:   e.args.Me,
		Name: e.args.DeviceName,
		Lks:  e.args.Lks,
	}
	regEng := NewDeviceRegister(m.G(), regArgs)
	if err := RunEngine2(m, regEng); err != nil {
		return err
	}

	deviceID := regEng.DeviceID()

	kgArgs := &DeviceKeygenArgs{
		Me:             e.args.Me,
		DeviceID:       deviceID,
		DeviceName:     e.args.DeviceName,
		DeviceType:     e.args.DeviceType,
		Lks:            e.args.Lks,
		IsEldest:       e.args.IsEldest,
		PerUserKeyring: e.args.PerUserKeyring,
	}
	kgEng := NewDeviceKeygen(m.G(), kgArgs)
	if err = RunEngine2(m, kgEng); err != nil {
		return err
	}

	pargs := &DeviceKeygenPushArgs{
		Signer:    e.args.Signer,
		EldestKID: e.args.EldestKID,
	}
	if err = kgEng.Push(m, pargs); err != nil {
		return err
	}

	e.signingKey = kgEng.SigningKey()
	e.encryptionKey = kgEng.EncryptionKey()
	// TODO get the per-user-key and save it if it was generated

	err = m.ActiveDevice().Set(m, e.args.Me.GetUID(), deviceID, e.signingKey, e.encryptionKey, e.args.DeviceName)
	if err != nil {
		return err
	}

	// Sync down secrets for future offline login attempts to work.
	// This will largely just download what we just uploaded, but it's
	// easy to do this way.
	w := m.ActiveDevice().SyncSecrets(m)

	if w != nil {
		m.CWarningf("Error sync secrets: %s", w.Error())
	}

	return nil
}

func (e *DeviceWrap) SigningKey() libkb.GenericKey {
	return e.signingKey
}

func (e *DeviceWrap) EncryptionKey() libkb.NaclDHKeyPair {
	return e.encryptionKey
}

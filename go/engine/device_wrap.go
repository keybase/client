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
	deviceID      keybase1.DeviceID
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
		&DeviceKeygen{},
	}
}

func (e *DeviceWrap) registerDevice(m libkb.MetaContext) (err error) {

	defer m.CTrace("DeviceWrap#registerDevice", func() error { return err })()

	if e.args.Me.HasCurrentDeviceInCurrentInstall() {
		return libkb.DeviceAlreadyProvisionedError{}
	}

	if e.deviceID, err = libkb.NewDeviceID(); err != nil {
		return err
	}

	if err = e.args.Lks.GenerateServerHalf(); err != nil {
		return err
	}

	m.CDebugf("Device name: %s", e.args.DeviceName)
	m.CDebugf("Device ID: %s", e.deviceID)

	m.UIs().LogUI.Debug("Setting Device ID to %s", e.deviceID)
	if err = m.SetDeviceIDWithinRegistration(e.deviceID); err != nil {
		return err
	}
	return nil
}

func (e *DeviceWrap) genKeys(m libkb.MetaContext) (err error) {
	defer m.CTrace("DeviceWrap#genKeys", func() error { return err })()

	kgArgs := &DeviceKeygenArgs{
		Me:             e.args.Me,
		DeviceID:       e.deviceID,
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

	return nil
}

func (e *DeviceWrap) setActiveDevice(m libkb.MetaContext) (err error) {
	defer m.CTrace("DeviceWrap#setActiveDevice", func() error { return err })()

	if err := m.SetActiveDevice(e.args.Me.GetUID(), e.deviceID, e.signingKey, e.encryptionKey, e.args.DeviceName); err != nil {
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

// Run starts the engine.
func (e *DeviceWrap) Run(m libkb.MetaContext) (err error) {

	defer m.CTrace("DeviceWrap#Run", func() error { return err })()

	if err = e.registerDevice(m); err != nil {
		return err
	}

	if err = e.genKeys(m); err != nil {
		return err
	}

	if err = e.setActiveDevice(m); err != nil {
		return err
	}

	return nil
}

func (e *DeviceWrap) SigningKey() libkb.GenericKey {
	return e.signingKey
}

func (e *DeviceWrap) EncryptionKey() libkb.NaclDHKeyPair {
	return e.encryptionKey
}

func (e *DeviceWrap) DeviceID() keybase1.DeviceID {
	return e.deviceID
}

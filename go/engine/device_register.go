// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type DeviceRegisterArgs struct {
	Me   *libkb.User
	Name string
	Lks  *libkb.LKSec
}

type DeviceRegister struct {
	args     *DeviceRegisterArgs
	deviceID keybase1.DeviceID
	libkb.Contextified
}

func NewDeviceRegister(g *libkb.GlobalContext, args *DeviceRegisterArgs) *DeviceRegister {
	return &DeviceRegister{
		args:         args,
		Contextified: libkb.NewContextified(g),
	}
}

func (d *DeviceRegister) Name() string {
	return "DeviceRegister"
}

func (d *DeviceRegister) RequiredUIs() []libkb.UIKind {
	return nil
}

func (d *DeviceRegister) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (d *DeviceRegister) Prereqs() Prereqs { return Prereqs{} }

func (d *DeviceRegister) Run(m libkb.MetaContext) error {
	if d.args.Me.HasCurrentDeviceInCurrentInstall() {
		return libkb.DeviceAlreadyProvisionedError{}
	}

	var err error
	if d.deviceID, err = libkb.NewDeviceID(); err != nil {
		return err
	}

	if err := d.args.Lks.GenerateServerHalf(); err != nil {
		return err
	}

	m.CDebugf("Device name: %s", d.args.Name)
	m.CDebugf("Device ID: %s", d.deviceID)

	if wr := m.G().Env.GetConfigWriter(); wr != nil {
		if err := wr.SetDeviceID(d.deviceID); err != nil {
			return err
		}
		m.UIs().LogUI.Debug("Setting Device ID to %s", d.deviceID)
	}

	return nil
}

func (d *DeviceRegister) DeviceID() keybase1.DeviceID {
	return d.deviceID
}

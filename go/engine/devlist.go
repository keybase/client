// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"sort"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// DevList is an engine that gets a list of all the user's
// devices.
type DevList struct {
	devices []keybase1.Device
	libkb.Contextified
}

// NewDevList creates a DevList engine.
func NewDevList(g *libkb.GlobalContext) *DevList {
	return &DevList{
		Contextified: libkb.NewContextified(g),
	}
}

func (d *DevList) Name() string {
	return "DevList"
}

func (d *DevList) Prereqs() Prereqs {
	return Prereqs{Session: true}
}

func (d *DevList) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{libkb.LogUIKind}
}

func (d *DevList) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (d *DevList) Run(ctx *Context) error {
	uid := d.G().GetMyUID()
	var err error
	var devs libkb.DeviceKeyMap
	aerr := d.G().LoginState().Account(func(a *libkb.Account) {
		if err = libkb.RunSyncer(a.SecretSyncer(), uid, a.LoggedIn(), a.LocalSession()); err != nil {
			return
		}
		devs, err = a.SecretSyncer().ActiveDevices(libkb.AllDeviceTypes)
	}, "DevList - ActiveDevices")
	if aerr != nil {
		return aerr
	}
	if err != nil {
		return err
	}

	var pdevs []keybase1.Device
	for k, v := range devs {
		pdevs = append(pdevs, keybase1.Device{
			Type:         v.Type,
			Name:         v.Display(),
			DeviceID:     k,
			CTime:        keybase1.TimeFromSeconds(v.CTime),
			MTime:        keybase1.TimeFromSeconds(v.MTime),
			LastUsedTime: keybase1.TimeFromSeconds(v.LastUsedTime),
		})
	}
	sort.Sort(dname(pdevs))
	d.devices = pdevs

	return nil
}

// List returns the devices for a user.
func (d *DevList) List() []keybase1.Device {
	return d.devices
}

type dname []keybase1.Device

func (d dname) Len() int           { return len(d) }
func (d dname) Swap(i, j int)      { d[i], d[j] = d[j], d[i] }
func (d dname) Less(i, j int) bool { return d[i].Name < d[j].Name }

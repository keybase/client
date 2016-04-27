// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

// DeviceHistory is an engine.
type DeviceHistory struct {
	libkb.Contextified
	username string
	user     *libkb.User
	devices  []keybase1.DeviceDetail
}

// NewDeviceHistory creates a DeviceHistory engine to lookup the
// device history for username.
func NewDeviceHistory(g *libkb.GlobalContext, username string) *DeviceHistory {
	return &DeviceHistory{
		Contextified: libkb.NewContextified(g),
		username:     username,
	}
}

// NewDeviceHistorySelf creates a DeviceHistory engine to lookup
// the device history of the current user.
func NewDeviceHistorySelf(g *libkb.GlobalContext) *DeviceHistory {
	return &DeviceHistory{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *DeviceHistory) Name() string {
	return "DeviceHistory"
}

// GetPrereqs returns the engine prereqs.
func (e *DeviceHistory) Prereqs() Prereqs {
	if len(e.username) > 0 {
		return Prereqs{}
	}
	return Prereqs{Session: true}
}

// RequiredUIs returns the required UIs.
func (e *DeviceHistory) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *DeviceHistory) SubConsumers() []libkb.UIConsumer {
	return nil
}

// Run starts the engine.
func (e *DeviceHistory) Run(ctx *Context) error {
	if err := e.loadUser(); err != nil {
		return err
	}
	if err := e.loadDevices(); err != nil {
		return err
	}
	return nil
}

func (e *DeviceHistory) Devices() []keybase1.DeviceDetail {
	return e.devices
}

func (e *DeviceHistory) loadUser() error {
	arg := libkb.NewLoadUserPubOptionalArg(e.G())
	if len(e.username) == 0 {
		arg.Self = true
	} else {
		arg.Name = e.username
	}
	u, err := libkb.LoadUser(arg)
	if err != nil {
		return err
	}
	e.user = u
	return nil
}

func (e *DeviceHistory) loadDevices() error {
	ckf := e.user.GetComputedKeyFamily()
	if ckf == nil {
		return errors.New("nil ComputedKeyFamily for user")
	}
	ckis := e.user.GetComputedKeyInfos()
	if ckis == nil {
		return errors.New("nil ComputedKeyInfos for user")
	}

	for _, d := range ckf.GetAllDevices() {
		exp := keybase1.DeviceDetail{Device: *(d.ProtExport())}
		cki, ok := ckis.Infos[d.Kid]
		if !ok {
			return fmt.Errorf("no ComputedKeyInfo for device %s, kid %s", d.ID, d.Kid)
		}

		if cki.Eldest {
			exp.Eldest = true
		} else {
			prov, err := e.provisioner(d, ckis, cki)
			if err != nil {
				return err
			}
			if prov != nil {
				exp.Provisioner = prov.ProtExport()
				t := keybase1.TimeFromSeconds(cki.DelegatedAt.Unix)
				exp.ProvisionedAt = &t
			}
		}

		if cki.RevokedAt != nil {
			rt := keybase1.TimeFromSeconds(cki.RevokedAt.Unix)
			exp.RevokedAt = &rt
		}

		e.devices = append(e.devices, exp)
	}

	return nil
}

func (e *DeviceHistory) provisioner(d *libkb.Device, ckis *libkb.ComputedKeyInfos, info *libkb.ComputedKeyInfo) (*libkb.Device, error) {
	for _, v := range info.Delegations {
		did, ok := ckis.KIDToDeviceID[v]
		if !ok {
			return nil, fmt.Errorf("device %s provisioned by kid %s, but couldn't find matching device ID in ComputedKeyInfos", d.ID, v)
		}
		prov, ok := ckis.Devices[did]
		if !ok {
			return nil, fmt.Errorf("device %s provisioned by device %s, but couldn't find matchind device in ComputedKeyInfos", d.ID, did)
		}
		return prov, nil
	}

	return nil, nil
}

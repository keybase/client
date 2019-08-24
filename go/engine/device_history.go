// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"errors"
	"fmt"
	"time"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// DeviceHistory is an engine.
type DeviceHistory struct {
	libkb.Contextified
	username string
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
	return Prereqs{Device: true}
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
func (e *DeviceHistory) Run(m libkb.MetaContext) error {

	arg := e.loadUserArg(m)
	err := m.G().GetFullSelfer().WithUser(arg, func(u *libkb.User) error {
		return e.loadDevices(m, u)
	})
	return err
}

func (e *DeviceHistory) Devices() []keybase1.DeviceDetail {
	return e.devices
}

func (e *DeviceHistory) loadUserArg(m libkb.MetaContext) libkb.LoadUserArg {
	arg := libkb.NewLoadUserPubOptionalArg(m.G())
	if len(e.username) == 0 {
		arg = arg.WithSelf(true)
	} else {
		arg = arg.WithName(e.username)
	}
	return arg
}

func (e *DeviceHistory) loadDevices(m libkb.MetaContext, user *libkb.User) error {
	ckf := user.GetComputedKeyFamily()
	if ckf == nil {
		return errors.New("nil ComputedKeyFamily for user")
	}
	ckis := user.GetComputedKeyInfos()
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
			prov, err := e.provisioner(m, d, ckis, cki)
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
		if !cki.RevokedBy.IsNil() {
			exp.RevokedBy = cki.RevokedBy
			if deviceID, ok := ckis.KIDToDeviceID[cki.RevokedBy]; ok {
				if device, ok := ckis.Devices[deviceID]; ok {
					exp.RevokedByDevice = device.ProtExport()
				}
			}
		}

		if m.G().Env.GetDeviceIDForUsername(user.GetNormalizedName()).Eq(d.ID) {
			exp.CurrentDevice = true
		}

		e.devices = append(e.devices, exp)
	}

	// Load the last used times, but only if these are your own devices. The
	// API won't give you those times for other people's devices.
	if user.GetNormalizedName().Eq(m.G().Env.GetUsername()) {
		lastUsedTimes, err := e.getLastUsedTimes(m)
		if err != nil {
			return err
		}
		for i := range e.devices {
			detail := &e.devices[i]
			lastUsedTime, ok := lastUsedTimes[detail.Device.DeviceID]
			if !ok {
				if detail.RevokedAt != nil {
					// The server only provides last used times for active devices.
					continue
				}
				return fmt.Errorf("Failed to load last used time for device %s", detail.Device.DeviceID)
			}
			detail.Device.LastUsedTime = keybase1.TimeFromSeconds(lastUsedTime.Unix())
		}
	}

	return nil
}

func (e *DeviceHistory) provisioner(m libkb.MetaContext, d *libkb.Device, ckis *libkb.ComputedKeyInfos, info *libkb.ComputedKeyInfo) (*libkb.Device, error) {
	for _, v := range info.Delegations {
		if kbcrypto.AlgoType(v.GetKeyType()) != kbcrypto.KIDNaclEddsa {
			// only concerned with device history, not pgp provisioners
			continue
		}

		did, ok := ckis.KIDToDeviceID[v]
		if !ok {
			return nil, fmt.Errorf("device %s provisioned by kid %s, but couldn't find matching device ID in ComputedKeyInfos", d.ID, v)
		}
		prov, ok := ckis.Devices[did]
		if !ok {
			return nil, fmt.Errorf("device %s provisioned by device %s, but couldn't find matching device in ComputedKeyInfos", d.ID, did)
		}
		return prov, nil
	}

	return nil, nil
}

func (e *DeviceHistory) getLastUsedTimes(m libkb.MetaContext) (ret map[keybase1.DeviceID]time.Time, err error) {
	defer m.Trace("DeviceHistory#getLastUsedTimes", func() error { return err })()
	var devs libkb.DeviceKeyMap
	var ss *libkb.SecretSyncer
	ss, err = m.ActiveDevice().SyncSecretsForce(m)
	if err != nil {
		return nil, err
	}
	devs, err = ss.ActiveDevices(libkb.AllDeviceTypes)
	if err != nil {
		return nil, err
	}
	ret = map[keybase1.DeviceID]time.Time{}
	for deviceID, dev := range devs {
		ret[deviceID] = time.Unix(dev.LastUsedTime, 0)
	}
	return ret, nil
}

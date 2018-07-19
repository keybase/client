// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// DeviceCloneState creates a new token and sends it (along
// with the previously created token) to the server in an effort
// to identify possible cloning of devices.

package engine

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/keybase/client/go/libkb"
)

type DeviceCloneStateEngine struct {
	libkb.Contextified
}

// NewDeviceCloneStateEngine creates a new DeviceCloneStateEngine.
func NewDeviceCloneStateEngine(g *libkb.GlobalContext) *DeviceCloneStateEngine {
	return &DeviceCloneStateEngine{Contextified: libkb.NewContextified(g)}
}

// Name is the unique engine name.
func (e *DeviceCloneStateEngine) Name() string {
	return "DeviceCloneStateEngine"
}

// Prereqs returns the engine prereqs.
func (e *DeviceCloneStateEngine) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs. There are none.
func (e *DeviceCloneStateEngine) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers returns the other UI consumers for this engine. There are none.
func (e *DeviceCloneStateEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *DeviceCloneStateEngine) fetchState(m libkb.MetaContext) libkb.DeviceCloneState {
	env := m.G().GetEnv()
	un := env.GetUsername()
	return env.GetConfig().GetDeviceCloneState(un)
}

func (e *DeviceCloneStateEngine) persistState(m libkb.MetaContext, d libkb.DeviceCloneState) error {
	env := m.G().GetEnv()
	un := env.GetUsername()
	return env.GetConfigWriter().SetDeviceCloneState(un, d)
}

func (e *DeviceCloneStateEngine) ClonesCount(m libkb.MetaContext) int {
	count := e.fetchState(m).Clones
	if count < 1 {
		count = 1
	}
	return count
}

// Run starts the engine.
func (e *DeviceCloneStateEngine) Run(m libkb.MetaContext) error {
	d := e.fetchState(m)
	p, s := d.Prior, d.Stage
	if p == "" {
		//first run
		p = libkb.DefaultCloneTokenValue
	}
	if s == "" {
		buf := make([]byte, 16)
		rand.Read(buf)
		s = hex.EncodeToString(buf)
		tmp := libkb.DeviceCloneState{Prior: p, Stage: s, Clones: d.Clones}
		err := e.persistState(m, tmp)
		if err != nil {
			return err
		}
	}

	// POST these tokens to the server
	arg := libkb.APIArg{
		Endpoint:    "device/clone_detection_token",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"device_id": m.G().ActiveDevice.DeviceID(),
			"prior":     libkb.S{Val: p},
			"stage":     libkb.S{Val: s},
		},
		NetContext:     m.Ctx(),
		AppStatusCodes: []int{libkb.SCOk},
	}
	res, err := m.G().API.Post(arg)
	if err != nil {
		return err
	}
	persistedToken, err := res.Body.AtKey("token").GetString()
	if err != nil {
		return err
	}
	clones, err := res.Body.AtKey("clones").GetInt()
	if err != nil {
		return err
	}
	tmp := libkb.DeviceCloneState{Prior: persistedToken, Stage: "", Clones: clones}
	return e.persistState(m, tmp)
}

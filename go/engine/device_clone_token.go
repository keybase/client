// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// DeviceCloneToken creates a new token and sends it (along
// with the previously created token) to the server in an effort
// to identify possible cloning of devices.

package engine

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/keybase/client/go/libkb"
)

type DeviceCloneTokenEngine struct {
	libkb.Contextified
}

// NewDeviceCloneToken creates a new DeviceCloneTokenEngine.
func NewDeviceCloneTokenEngine(g *libkb.GlobalContext) *DeviceCloneTokenEngine {
	return &DeviceCloneTokenEngine{Contextified: libkb.NewContextified(g)}
}

// Name is the unique engine name.
func (e *DeviceCloneTokenEngine) Name() string {
	return "DeviceCloneTokenEngine"
}

// Prereqs returns the engine prereqs.
func (e *DeviceCloneTokenEngine) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs. There are none.
func (e *DeviceCloneTokenEngine) RequiredUIs() []libkb.UIKind {
	return nil
}

// SubConsumers returns the other UI consumers for this engine. There are none.
func (e *DeviceCloneTokenEngine) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *DeviceCloneTokenEngine) getToken(m libkb.MetaContext) libkb.DeviceCloneToken {
	env := m.G().GetEnv()
	un := env.GetUsername()
	return env.GetConfig().GetDeviceCloneToken(un)
}

func (e *DeviceCloneTokenEngine) persistToken(m libkb.MetaContext, d libkb.DeviceCloneToken) error {
	env := m.G().GetEnv()
	un := env.GetUsername()
	return env.GetConfigWriter().SetDeviceCloneToken(un, d)
}

func (e *DeviceCloneTokenEngine) ClonesCount(m libkb.MetaContext) int {
	count := e.getToken(m).Clones
	if count < 1 {
		count = 1
	}
	return count
}

// Run starts the engine.
func (e *DeviceCloneTokenEngine) Run(m libkb.MetaContext) error {
	d := e.getToken(m)
	p, s := d.Prior, d.Stage
	if p == "" {
		//first run
		p = libkb.DefaultCloneTokenValue
		s = ""
	}
	if s == "" {
		buf := make([]byte, 16)
		rand.Read(buf)
		s = hex.EncodeToString(buf)
		tmp := libkb.DeviceCloneToken{Prior: p, Stage: s, Clones: d.Clones}
		err := e.persistToken(m, tmp)
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
	tmp := libkb.DeviceCloneToken{Prior: persistedToken, Stage: "", Clones: clones}
	return e.persistToken(m, tmp)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// DeviceHandler is the RPC handler for the device interface.
type DeviceHandler struct {
	*BaseHandler
	libkb.Contextified
}

// NewDeviceHandler creates a DeviceHandler for the xp transport.
func NewDeviceHandler(xp rpc.Transporter, g *libkb.GlobalContext) *DeviceHandler {
	return &DeviceHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

// DeviceList returns a list of all the devices for a user.
func (h *DeviceHandler) DeviceList(_ context.Context, sessionID int) ([]keybase1.Device, error) {
	ctx := &engine.Context{
		LogUI:     h.getLogUI(sessionID),
		SessionID: sessionID,
	}
	eng := engine.NewDevList(h.G())
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.List(), nil
}

// DeviceAdd starts the kex2 device provisioning on the
// provisioner (device X/C1)
func (h *DeviceHandler) DeviceAdd(_ context.Context, sessionID int) error {
	ctx := &engine.Context{
		ProvisionUI: h.getProvisionUI(sessionID),
		SecretUI:    h.getSecretUI(sessionID, h.G()),
		SessionID:   sessionID,
	}
	eng := engine.NewDeviceAdd(h.G())
	return engine.RunEngine(eng, ctx)
}

// CheckDeviceNameFormat verifies that the device name has a valid
// format.
func (h *DeviceHandler) CheckDeviceNameFormat(_ context.Context, arg keybase1.CheckDeviceNameFormatArg) (bool, error) {
	return libkb.CheckDeviceName.F(arg.Name), nil
}

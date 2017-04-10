// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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

// DeviceHistoryList returns a list of all the devices for a user,
// with detailed history and provisioner, revoker information.
func (h *DeviceHandler) DeviceHistoryList(nctx context.Context, sessionID int) ([]keybase1.DeviceDetail, error) {
	ctx := &engine.Context{
		LogUI:      h.getLogUI(sessionID),
		NetContext: nctx,
		SessionID:  sessionID,
	}
	eng := engine.NewDeviceHistorySelf(h.G())
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.Devices(), nil
}

// DeviceAdd starts the kex2 device provisioning on the
// provisioner (device X/C1)
func (h *DeviceHandler) DeviceAdd(c context.Context, sessionID int) error {
	ctx := &engine.Context{
		ProvisionUI: h.getProvisionUI(sessionID),
		SecretUI:    h.getSecretUI(sessionID, h.G()),
		SessionID:   sessionID,
		NetContext:  c,
	}
	eng := engine.NewDeviceAdd(h.G())
	return engine.RunEngine(eng, ctx)
}

// CheckDeviceNameFormat verifies that the device name has a valid
// format.
func (h *DeviceHandler) CheckDeviceNameFormat(_ context.Context, arg keybase1.CheckDeviceNameFormatArg) (bool, error) {
	ok := libkb.CheckDeviceName.F(arg.Name)
	if ok {
		return ok, nil
	}
	return false, errors.New(libkb.CheckDeviceName.Hint)
}

func (h *DeviceHandler) CheckDeviceNameForUser(_ context.Context, arg keybase1.CheckDeviceNameForUserArg) error {
	_, err := h.G().API.Get(libkb.APIArg{
		Endpoint:    "device/check_name",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"username":   libkb.S{Val: arg.Username},
			"devicename": libkb.S{Val: arg.Devicename},
		},
	})

	if err == nil {
		return err
	}

	if apiErr, ok := err.(*libkb.APIError); ok {
		switch apiErr.Code {
		case libkb.SCDeviceNameInUse:
			return libkb.DeviceNameInUseError{}
		case libkb.SCInputError:
			return libkb.DeviceBadNameError{}
		}
	}

	return err
}

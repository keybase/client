package main

import (
	"github.com/keybase/go/libkb"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// DeviceHandler is the RPC handler for the track interface.
type DeviceHandler struct {
	BaseHandler
}

// NewDeviceHandler creates a DeviceHandler for the xp transport.
func NewDeviceHandler(xp *rpc2.Transport) *DeviceHandler {
	return &DeviceHandler{BaseHandler{xp: xp}}
}

// Register registers a device.
func (h *DeviceHandler) Register(deviceName string) error {
	engine := libkb.NewDeviceEngine()
	if err := engine.Init(); err != nil {
		return err
	}
	return engine.Run(deviceName)
}

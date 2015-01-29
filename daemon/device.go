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
	// XXX need me user here...this is just so it compiles
	panic("need to implement this")
	engine := libkb.NewDeviceEngine(nil)
	if err := engine.Init(); err != nil {
		return err
	}
	return engine.Run(deviceName)
}

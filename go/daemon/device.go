package main

import (
	"github.com/keybase/client/go/engine"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// DeviceHandler is the RPC handler for the device interface.
type DeviceHandler struct {
	BaseHandler
}

// NewDeviceHandler creates a DeviceHandler for the xp transport.
func NewDeviceHandler(xp *rpc2.Transport) *DeviceHandler {
	return &DeviceHandler{BaseHandler{xp: xp}}
}

func (h *DeviceHandler) DeviceList(sessionID int) ([]keybase_1.Device, error) {
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID)}
	eng := engine.NewDevList()
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.List(), nil
}

// DeviceAdd adds a sibkey using a SibkeyEngine.
func (h *DeviceHandler) DeviceAdd(phrase string) error {
	sessionID := nextSessionId()
	ctx := &engine.Context{SecretUI: h.getSecretUI(sessionID)}
	eng := engine.NewKexSib(G, phrase)
	return engine.RunEngine(eng, ctx)
}

package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// DeviceHandler is the RPC handler for the device interface.
type DeviceHandler struct {
	*CancelHandler
}

// NewDeviceHandler creates a DeviceHandler for the xp transport.
func NewDeviceHandler(xp *rpc2.Transport) *DeviceHandler {
	return &DeviceHandler{CancelHandler: NewCancelHandler(xp)}
}

func (h *DeviceHandler) DeviceList(sessionID int) ([]keybase1.Device, error) {
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID)}
	eng := engine.NewDevList(G)
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.List(), nil
}

// DeviceAdd adds a sibkey using a SibkeyEngine.
func (h *DeviceHandler) DeviceAdd(arg keybase1.DeviceAddArg) error {
	locksmithUI := NewRemoteLocksmithUI(arg.SessionID, h.rpcClient())
	ctx := &engine.Context{SecretUI: h.getSecretUI(arg.SessionID), LocksmithUI: locksmithUI}
	eng := engine.NewKexSib(G, arg.SecretPhrase)

	h.setCanceler(arg.SessionID, eng)
	defer h.removeCanceler(arg.SessionID)

	return engine.RunEngine(eng, ctx)
}

// DeviceAddCancel stops the device provisioning authorized with
// DeviceAdd.
func (h *DeviceHandler) DeviceAddCancel(sessionID int) error {
	c := h.canceler(sessionID)
	if c == nil {
		return nil
	}
	return c.Cancel()
}

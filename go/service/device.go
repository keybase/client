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
	*CancelHandler
	libkb.Contextified
}

// NewDeviceHandler creates a DeviceHandler for the xp transport.
func NewDeviceHandler(xp rpc.Transporter, g *libkb.GlobalContext) *DeviceHandler {
	return &DeviceHandler{
		CancelHandler: NewCancelHandler(xp),
		Contextified:  libkb.NewContextified(g),
	}
}

func (h *DeviceHandler) DeviceList(_ context.Context, sessionID int) ([]keybase1.Device, error) {
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID)}
	eng := engine.NewDevList(h.G())
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	return eng.List(), nil
}

// DeviceAdd adds a sibkey using a SibkeyEngine.
func (h *DeviceHandler) DeviceAdd(_ context.Context, arg keybase1.DeviceAddArg) error {
	locksmithUI := NewRemoteLocksmithUI(arg.SessionID, h.rpcClient())
	ctx := &engine.Context{SecretUI: h.getSecretUI(arg.SessionID), LocksmithUI: locksmithUI}
	eng := engine.NewKexProvisioner(h.G(), arg.SecretPhrase)

	h.setCanceler(arg.SessionID, eng)
	defer h.removeCanceler(arg.SessionID)

	return engine.RunEngine(eng, ctx)
}

// DeviceAddCancel stops the device provisioning authorized with
// DeviceAdd.
func (h *DeviceHandler) DeviceAddCancel(_ context.Context, sessionID int) error {
	c := h.canceler(sessionID)
	if c == nil {
		return nil
	}
	return c.Cancel()
}

// DeviceXAdd starts the kex2 device provisioning on the
// provisioner (device X/C1)
func (h *DeviceHandler) DeviceXAdd(_ context.Context, sessionID int) error {
	ctx := &engine.Context{
		ProvisionUI: h.getProvisionUI(sessionID),
		SecretUI:    h.getSecretUI(sessionID),
	}
	eng := engine.NewDeviceAdd(h.G())
	return engine.RunEngine(eng, ctx)
}

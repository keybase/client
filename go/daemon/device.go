package main

import (
	"sync"

	"github.com/keybase/client/go/engine"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// DeviceHandler is the RPC handler for the device interface.
type DeviceHandler struct {
	BaseHandler
	kexsibEngMu sync.Mutex
	kexsibEng   *engine.KexSib
}

// NewDeviceHandler creates a DeviceHandler for the xp transport.
func NewDeviceHandler(xp *rpc2.Transport) *DeviceHandler {
	return &DeviceHandler{BaseHandler: BaseHandler{xp: xp}}
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
	sessionID := nextSessionID()
	locksmithUI := NewRemoteLocksmithUI(sessionID, h.getRpcClient())
	ctx := &engine.Context{SecretUI: h.getSecretUI(sessionID), LocksmithUI: locksmithUI}
	h.kexsibEngMu.Lock()
	h.kexsibEng = engine.NewKexSib(G, phrase)
	h.kexsibEngMu.Unlock()

	err := engine.RunEngine(h.kexsibEng, ctx)

	h.kexsibEngMu.Lock()
	h.kexsibEng = nil
	h.kexsibEngMu.Unlock()

	return err
}

// DeviceAddCancel stops the device provisioning authorized with
// DeviceAdd.
func (h *DeviceHandler) DeviceAddCancel() error {
	h.kexsibEngMu.Lock()
	defer h.kexsibEngMu.Unlock()
	if h.kexsibEng == nil {
		return nil
	}
	return h.kexsibEng.Cancel()
}

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
	kexEngsMu sync.RWMutex
	kexEngs   map[int]*engine.KexSib
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
func (h *DeviceHandler) DeviceAdd(arg keybase_1.DeviceAddArg) error {
	sessionID := nextSessionID()
	locksmithUI := NewRemoteLocksmithUI(sessionID, h.getRpcClient())
	ctx := &engine.Context{SecretUI: h.getSecretUI(sessionID), LocksmithUI: locksmithUI}
	eng := engine.NewKexSib(G, arg.SecretPhrase)

	// use sessionID in arg for map key, so clients can cancel
	h.kexEngsMu.Lock()
	h.kexEngs[arg.SessionID] = eng
	h.kexEngsMu.Unlock()

	err := engine.RunEngine(eng, ctx)

	h.kexEngsMu.Lock()
	delete(h.kexEngs, arg.SessionID)
	h.kexEngsMu.Unlock()

	return err
}

// DeviceAddCancel stops the device provisioning authorized with
// DeviceAdd.
func (h *DeviceHandler) DeviceAddCancel(sessionID int) error {
	h.kexEngsMu.RLock()
	eng, ok := h.kexEngs[sessionID]
	h.kexEngsMu.RUnlock()
	if !ok {
		return nil
	}
	if eng == nil {
		return nil
	}
	return eng.Cancel()
}

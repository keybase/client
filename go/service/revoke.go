package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RevokeHandler struct {
	*BaseHandler
}

func NewRevokeHandler(xp *rpc2.Transport) *RevokeHandler {
	return &RevokeHandler{BaseHandler: NewBaseHandler(xp)}
}

func (h *RevokeHandler) RevokeKey(arg keybase1.RevokeKeyArg) error {
	sessionID := arg.SessionID
	ctx := engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewRevokeKeyEngine(arg.KeyID, G)
	return engine.RunEngine(eng, &ctx)
}

func (h *RevokeHandler) RevokeDevice(arg keybase1.RevokeDeviceArg) error {
	sessionID := arg.SessionID
	ctx := engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewRevokeDeviceEngine(arg.DeviceID, G)
	return engine.RunEngine(eng, &ctx)
}

func (h *RevokeHandler) RevokeSigs(arg keybase1.RevokeSigsArg) error {
	ctx := engine.Context{
		LogUI:    h.getLogUI(arg.SessionID),
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewRevokeSigsEngine(arg.SigIDs, G)
	return engine.RunEngine(eng, &ctx)
}

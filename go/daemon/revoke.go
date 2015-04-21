package main

import (
	"github.com/keybase/client/go/engine"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type RevokeHandler struct {
	BaseHandler
}

func NewRevokeHandler(xp *rpc2.Transport) *RevokeHandler {
	return &RevokeHandler{BaseHandler{xp: xp}}
}

func (h *RevokeHandler) RevokeKey(arg keybase_1.RevokeKeyArg) error {
	sessionID := arg.SessionID
	ctx := engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewRevokeEngine(arg.Id, engine.REVOKE_KEY)
	return engine.RunEngine(eng, &ctx)
}

func (h *RevokeHandler) RevokeDevice(arg keybase_1.RevokeDeviceArg) error {
	sessionID := arg.SessionID
	ctx := engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewRevokeEngine(arg.Id, engine.REVOKE_DEVICE)
	return engine.RunEngine(eng, &ctx)
}

func (h *RevokeHandler) RevokeSigs(arg keybase_1.RevokeSigsArg) error {
	ctx := engine.Context{
		LogUI:    h.getLogUI(arg.SessionID),
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewRevokeSigsEngine(arg.Ids, arg.Seqnos)
	return engine.RunEngine(eng, &ctx)
}

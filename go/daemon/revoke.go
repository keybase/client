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

func (h *RevokeHandler) Revoke(arg keybase_1.RevokeArg) error {
	sessionID := arg.SessionID
	ctx := engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewRevokeEngine(arg.Id, arg.IsDevice)
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

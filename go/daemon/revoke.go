package main

import (
	"github.com/keybase/client/go/engine"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// RevokeHandler is the RPC handler for the track interface.
type RevokeHandler struct {
	BaseHandler
}

// NewRevokeHandler creates a RevokeHandler for the xp transport.
func NewRevokeHandler(xp *rpc2.Transport) *RevokeHandler {
	return &RevokeHandler{BaseHandler{xp: xp}}
}

// Revoke creates a RevokeEngine and runs it.
func (h *RevokeHandler) Revoke(arg keybase_1.RevokeArg) error {
	sessionID := arg.SessionID
	ctx := engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewRevokeEngine(arg.Id, arg.IsDevice)
	return engine.RunEngine(eng, &ctx)
}

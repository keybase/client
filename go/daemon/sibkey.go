package main

import (
	"github.com/keybase/client/go/engine"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// SibkeyHandler is the RPC handler for the sibkey interface.
type SibkeyHandler struct {
	BaseHandler
}

// NewSibkeyHandler creates a SibkeyHandler for the xp transport.
func NewSibkeyHandler(xp *rpc2.Transport) *SibkeyHandler {
	return &SibkeyHandler{BaseHandler{xp: xp}}
}

// Add adds a sibkey using a SibkeyEngine.
func (h *SibkeyHandler) Add(phrase string) error {
	sessionID := nextSessionId()
	ctx := &engine.Context{SecretUI: h.getSecretUI(sessionID)}
	eng := engine.NewSibkey(G, phrase)
	return engine.RunEngine(eng, ctx, nil, nil)
}

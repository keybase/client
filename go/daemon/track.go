package main

import (
	"github.com/keybase/client/go/engine"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// TrackHandler is the RPC handler for the track interface.
type TrackHandler struct {
	BaseHandler
}

// NewTrackHandler creates a TrackHandler for the xp transport.
func NewTrackHandler(xp *rpc2.Transport) *TrackHandler {
	return &TrackHandler{BaseHandler{xp: xp}}
}

// Track creates a TrackEngine and runs it.
func (h *TrackHandler) Track(arg keybase_1.TrackArg) error {
	sessionID := arg.SessionID
	theirName := arg.TheirName
	earg := engine.TrackEngineArg{TheirName: theirName}
	ctx := engine.Context{
		TrackUI:  h.NewRemoteIdentifyUI(sessionID, theirName),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewTrackEngine(&earg)
	return engine.RunEngine(eng, &ctx, nil, nil)
}

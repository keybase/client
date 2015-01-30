package main

import (
	"github.com/keybase/go/libkb/engine"
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
func (h *TrackHandler) Track(theirName string) error {
	sessionID := nextSessionId()
	eng := engine.NewTrackEngine(theirName, NewRemoteIdentifyUI(sessionID, theirName, h.getRpcClient()), h.getSecretUI(sessionID))
	return eng.Run()
}

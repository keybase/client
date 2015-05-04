package service

import (
	"github.com/keybase/client/go/engine"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// TrackHandler is the RPC handler for the track interface.
type TrackHandler struct {
	*BaseHandler
}

// NewTrackHandler creates a TrackHandler for the xp transport.
func NewTrackHandler(xp *rpc2.Transport) *TrackHandler {
	return &TrackHandler{BaseHandler: NewBaseHandler(xp)}
}

// Track creates a TrackEngine and runs it.
func (h *TrackHandler) Track(arg keybase1.TrackArg) error {
	sessionID := arg.SessionID
	theirName := arg.TheirName
	earg := engine.TrackEngineArg{
		TheirName: theirName,
		Options: engine.TrackOptions{
			TrackLocalOnly: arg.LocalOnly,
			TrackApprove:   arg.ApproveRemote,
		},
	}
	ctx := engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(sessionID),
		SecretUI:   h.getSecretUI(sessionID),
	}
	eng := engine.NewTrackEngine(&earg)
	return engine.RunEngine(eng, &ctx)
}

// Untrack creates an UntrackEngine and runs it.
func (h *TrackHandler) Untrack(arg keybase1.UntrackArg) error {
	sessionID := arg.SessionID
	theirName := arg.TheirName
	earg := engine.UntrackEngineArg{
		TheirName: theirName,
	}
	ctx := engine.Context{
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewUntrackEngine(&earg)
	return engine.RunEngine(eng, &ctx)
}

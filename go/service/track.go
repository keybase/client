package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

// TrackHandler is the RPC handler for the track interface.
type TrackHandler struct {
	*BaseHandler
}

// NewTrackHandler creates a TrackHandler for the xp transport.
func NewTrackHandler(xp rpc.Transporter) *TrackHandler {
	return &TrackHandler{BaseHandler: NewBaseHandler(xp)}
}

// Track creates a TrackEngine and runs it.
func (h *TrackHandler) Track(arg keybase1.TrackArg) error {
	earg := engine.TrackEngineArg{
		UserAssertion:    arg.UserAssertion,
		Options:          arg.Options,
		ForceRemoteCheck: arg.ForceRemoteCheck,
	}
	ctx := engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID),
		SecretUI:   h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewTrackEngine(&earg, G)
	return engine.RunEngine(eng, &ctx)
}

func (h *TrackHandler) TrackWithToken(arg keybase1.TrackWithTokenArg) error {
	earg := engine.TrackTokenArg{
		Token:   libkb.ImportIdentifyCacheToken(arg.TrackToken),
		Options: arg.Options,
	}
	ctx := engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID),
		SecretUI:   h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewTrackToken(&earg, G)
	return engine.RunEngine(eng, &ctx)
}

// Untrack creates an UntrackEngine and runs it.
func (h *TrackHandler) Untrack(arg keybase1.UntrackArg) error {
	earg := engine.UntrackEngineArg{
		Username: arg.Username,
	}
	ctx := engine.Context{
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewUntrackEngine(&earg, G)
	return engine.RunEngine(eng, &ctx)
}

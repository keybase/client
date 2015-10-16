package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// TrackHandler is the RPC handler for the track interface.
type TrackHandler struct {
	*BaseHandler
	libkb.Contextified
}

// NewTrackHandler creates a TrackHandler for the xp transport.
func NewTrackHandler(xp rpc.Transporter, g *libkb.GlobalContext) *TrackHandler {
	return &TrackHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

// Track creates a TrackEngine and runs it.
func (h *TrackHandler) Track(_ context.Context, arg keybase1.TrackArg) error {
	earg := engine.TrackEngineArg{
		UserAssertion:    arg.UserAssertion,
		Options:          arg.Options,
		ForceRemoteCheck: arg.ForceRemoteCheck,
	}
	ctx := engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewTrackEngine(&earg, h.G())
	return engine.RunEngine(eng, &ctx)
}

func (h *TrackHandler) TrackWithToken(_ context.Context, arg keybase1.TrackWithTokenArg) error {
	earg := engine.TrackTokenArg{
		Token:   libkb.ImportIdentifyCacheToken(arg.TrackToken),
		Options: arg.Options,
	}
	ctx := engine.Context{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewTrackToken(&earg, h.G())
	return engine.RunEngine(eng, &ctx)
}

// Untrack creates an UntrackEngine and runs it.
func (h *TrackHandler) Untrack(_ context.Context, arg keybase1.UntrackArg) error {
	earg := engine.UntrackEngineArg{
		Username: arg.Username,
	}
	ctx := engine.Context{
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewUntrackEngine(&earg, h.G())
	return engine.RunEngine(eng, &ctx)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"time"

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

	lastCheckTime time.Time
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
		Token:   arg.TrackToken,
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

func (h *TrackHandler) CheckTracking(_ context.Context, sessionID int) error {
	if !h.G().RateLimits.GetPermission(libkb.CheckTrackingRateLimit, libkb.TrackingRateLimitSeconds*time.Second) {
		h.G().Log.Debug("Skipping CheckTracking due to rate limit.")
		return nil
	}
	return libkb.CheckTracking(h.G())
}

func (h *TrackHandler) FakeTrackingChanged(_ context.Context, arg keybase1.FakeTrackingChangedArg) error {
	user, err := libkb.LoadUser(libkb.LoadUserArg{
		Name: arg.Username,
	})
	if err != nil {
		return err
	}
	h.G().NotifyRouter.HandleTrackingChanged(user.GetUID(), user.GetName())
	return nil
}

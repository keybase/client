// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"time"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// TrackHandler is the RPC handler for the track interface.
type TrackHandler struct {
	*BaseHandler
	libkb.Contextified

	lastCheckTime time.Time
}

var _ keybase1.TrackInterface = (*TrackHandler)(nil)

// NewTrackHandler creates a TrackHandler for the xp transport.
func NewTrackHandler(xp rpc.Transporter, g *libkb.GlobalContext) *TrackHandler {
	return &TrackHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

// Track creates a TrackEngine and runs it.
func (h *TrackHandler) Track(ctx context.Context, arg keybase1.TrackArg) (keybase1.ConfirmResult, error) {
	earg := engine.TrackEngineArg{
		UserAssertion:    arg.UserAssertion,
		Options:          arg.Options,
		ForceRemoteCheck: arg.ForceRemoteCheck,
	}
	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewTrackEngine(h.G(), &earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	err := engine.RunEngine2(m, eng)
	res := eng.ConfirmResult()
	return res, err
}

func (h *TrackHandler) TrackWithToken(ctx context.Context, arg keybase1.TrackWithTokenArg) error {
	earg := engine.TrackTokenArg{
		Token:   arg.TrackToken,
		Options: arg.Options,
	}
	uis := libkb.UIs{
		IdentifyUI: h.NewRemoteIdentifyUI(arg.SessionID, h.G()),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		SessionID:  arg.SessionID,
	}
	eng := engine.NewTrackToken(h.G(), &earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *TrackHandler) DismissWithToken(ctx context.Context, arg keybase1.DismissWithTokenArg) error {
	outcome, err := h.G().TrackCache().Get(arg.TrackToken)
	if err != nil {
		h.G().Log.Error("Failed to get track token", err)
		return err
	}
	if outcome.ResponsibleGregorItem == nil {
		h.G().Log.Debug("No responsible gregor item found for track token %s", arg.TrackToken)
		return nil
	}

	return h.G().GregorState.DismissItem(ctx, nil, outcome.ResponsibleGregorItem.Metadata().MsgID())
}

// Untrack creates an UntrackEngine and runs it.
func (h *TrackHandler) Untrack(ctx context.Context, arg keybase1.UntrackArg) error {
	earg := engine.UntrackEngineArg{
		Username: libkb.NewNormalizedUsername(arg.Username),
	}
	uis := libkb.UIs{
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewUntrackEngine(h.G(), &earg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *TrackHandler) CheckTracking(_ context.Context, sessionID int) error {
	if !h.G().RateLimits.GetPermission(libkb.CheckTrackingRateLimit, libkb.TrackingRateLimitSeconds*time.Second) {
		h.G().Log.Debug("Skipping CheckTracking due to rate limit.")
		return nil
	}
	return libkb.CheckTracking(h.G())
}

func (h *TrackHandler) FakeTrackingChanged(_ context.Context, arg keybase1.FakeTrackingChangedArg) error {
	user, err := libkb.LoadUser(libkb.NewLoadUserArg(h.G()).WithName(arg.Username))
	if err != nil {
		return err
	}
	h.G().NotifyRouter.HandleTrackingChanged(user.GetUID(), user.GetNormalizedName(), arg.IsTracking)
	return nil
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type RemoteIdentifyUI struct {
	libkb.Contextified
	sessionID  int
	uicli      keybase1.IdentifyUiClient
	logUI      libkb.LogUI
	strict     bool
	skipPrompt bool
}

type IdentifyHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewIdentifyHandler(xp rpc.Transporter, g *libkb.GlobalContext) *IdentifyHandler {
	return &IdentifyHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *IdentifyHandler) Identify(_ context.Context, arg keybase1.IdentifyArg) (keybase1.IdentifyRes, error) {
	res, err := h.identify(arg.SessionID, arg, true)
	if err != nil {
		return keybase1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) IdentifyDefault(_ context.Context, arg keybase1.IdentifyArg) (keybase1.IdentifyRes, error) {
	iarg := keybase1.IdentifyArg{UserAssertion: arg.UserAssertion, ForceRemoteCheck: arg.ForceRemoteCheck}
	res, err := h.identify(arg.SessionID, iarg, true)
	if err != nil {
		return keybase1.IdentifyRes{}, err
	}
	return *(res.Export()), nil
}

func (h *IdentifyHandler) makeContext(sessionID int, arg keybase1.IdentifyArg) (ret *engine.Context, err error) {
	var iui libkb.IdentifyUI

	h.G().Log.Debug("+ makeContext(%d, %v)", sessionID, arg)
	defer func() {
		h.G().Log.Debug("- makeContext -> %v", err)
	}()

	if arg.UseDelegateUI {
		h.G().Log.Debug("+ trying to delegate our UI")
		if h.G().UIRouter == nil {
			h.G().Log.Warning("Can't delegate to a UI in standalone mode")
		} else {
			iui, err = h.G().UIRouter.GetIdentifyUI()
			if err != nil {
				return nil, err
			}
		}
		h.G().Log.Debug("- delegated UI with success=(%v)", (iui != nil))
	}

	// If we failed to delegate, we can still fallback and just log to the terminal.
	if iui == nil {
		h.G().Log.Debug("| using a remote UI as normal")
		iui = h.NewRemoteIdentifyUI(sessionID, h.G())
	}

	if iui == nil {
		err = libkb.NoUIError{Which: "Identify"}
		return nil, err
	}

	logui := h.getLogUI(sessionID)
	if arg.TrackStatement {
		logui = logger.NewNull()
	}

	ctx := engine.Context{
		LogUI:      logui,
		IdentifyUI: iui,
	}
	return &ctx, nil
}

func (h *IdentifyHandler) identify(sessionID int, arg keybase1.IdentifyArg, doInteractive bool) (res *engine.IDRes, err error) {
	var ctx *engine.Context
	ctx, err = h.makeContext(sessionID, arg)
	if err != nil {
		return nil, err
	}
	eng := engine.NewIDEngine(&arg, h.G())
	err = engine.RunEngine(eng, ctx)
	res = eng.Result()
	return res, err
}

func (u *RemoteIdentifyUI) FinishWebProofCheck(p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) {
	u.uicli.FinishWebProofCheck(context.TODO(), keybase1.FinishWebProofCheckArg{
		SessionID: u.sessionID,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteIdentifyUI) FinishSocialProofCheck(p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) {
	u.uicli.FinishSocialProofCheck(context.TODO(), keybase1.FinishSocialProofCheckArg{
		SessionID: u.sessionID,
		Rp:        p,
		Lcr:       lcr,
	})
	return
}

func (u *RemoteIdentifyUI) Confirm(io *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	if u.skipPrompt {
		u.G().Log.Debug("skipping Confirm for %q", io.Username)
		return keybase1.ConfirmResult{IdentityConfirmed: true}, nil
	}
	return u.uicli.Confirm(context.TODO(), keybase1.ConfirmArg{SessionID: u.sessionID, Outcome: *io})
}

func (u *RemoteIdentifyUI) DisplayCryptocurrency(c keybase1.Cryptocurrency) {
	u.uicli.DisplayCryptocurrency(context.TODO(), keybase1.DisplayCryptocurrencyArg{SessionID: u.sessionID, C: c})
	return
}

func (u *RemoteIdentifyUI) DisplayKey(key keybase1.IdentifyKey) {
	u.uicli.DisplayKey(context.TODO(), keybase1.DisplayKeyArg{SessionID: u.sessionID, Key: key})
	return
}

func (u *RemoteIdentifyUI) ReportLastTrack(t *keybase1.TrackSummary) {
	u.uicli.ReportLastTrack(context.TODO(), keybase1.ReportLastTrackArg{SessionID: u.sessionID, Track: t})
	return
}

func (u *RemoteIdentifyUI) DisplayTrackStatement(s string) error {
	return u.uicli.DisplayTrackStatement(context.TODO(), keybase1.DisplayTrackStatementArg{Stmt: s, SessionID: u.sessionID})
}

func (u *RemoteIdentifyUI) ReportTrackToken(token libkb.IdentifyCacheToken) error {
	return u.uicli.ReportTrackToken(context.TODO(), keybase1.ReportTrackTokenArg{TrackToken: string(token), SessionID: u.sessionID})
}

func (u *RemoteIdentifyUI) LaunchNetworkChecks(id *keybase1.Identity, user *keybase1.User) {
	u.uicli.LaunchNetworkChecks(context.TODO(), keybase1.LaunchNetworkChecksArg{
		SessionID: u.sessionID,
		Identity:  *id,
		User:      *user,
	})
	return
}

func (u *RemoteIdentifyUI) Start(username string) {
	u.uicli.Start(context.TODO(), keybase1.StartArg{SessionID: u.sessionID, Username: username})
}

func (u *RemoteIdentifyUI) Finish() {
	u.uicli.Finish(context.TODO(), u.sessionID)
}

func (u *RemoteIdentifyUI) SetStrict(b bool) {
	u.strict = b
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"
	"time"

	"golang.org/x/net/context"
	"stathat.com/c/ramcache"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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
	c := ramcache.New()
	c.TTL = 5 * time.Minute
	c.MaxAge = 5 * time.Minute

	return &IdentifyHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *IdentifyHandler) Identify2(netCtx context.Context, arg keybase1.Identify2Arg) (res keybase1.Identify2Res, err error) {
	netCtx = libkb.WithLogTag(netCtx, "ID2")
	defer h.G().CTrace(netCtx, "IdentifyHandler#Identify2", func() error { return err })()

	iui := h.NewRemoteIdentifyUI(arg.SessionID, h.G())
	logui := h.getLogUI(arg.SessionID)
	ctx := engine.Context{
		LogUI:      logui,
		IdentifyUI: iui,
		SessionID:  arg.SessionID,
		NetContext: netCtx,
	}
	eng := engine.NewResolveThenIdentify2(h.G(), &arg)
	err = engine.RunEngine(eng, &ctx)
	resp := eng.Result()
	if resp != nil {
		res = *resp
	}
	return res, err
}

func (h *IdentifyHandler) IdentifyLite(netCtx context.Context, arg keybase1.IdentifyLiteArg) (res keybase1.IdentifyLiteRes, err error) {
	netCtx = libkb.WithLogTag(netCtx, "IDL")
	defer h.G().CTrace(netCtx, "IdentifyHandler#IdentifyLite", func() error { return err })()

	var au libkb.AssertionURL
	if len(arg.Assertion) > 0 {
		// It's OK to fail this assertion; it will be off in the case of regular lookups
		// for users like `t_ellen` without a `type` specification
		au, _ = libkb.ParseAssertionURL(h.G().MakeAssertionContext(), arg.Assertion, true)
	}

	if arg.Id.IsTeamOrSubteam() || libkb.AssertionIsTeam(au) {
		return teams.IdentifyLite(netCtx, h.G(), arg, au)
	}

	return h.identifyLiteUser(netCtx, arg)
}

func (h *IdentifyHandler) identifyLiteUser(netCtx context.Context, arg keybase1.IdentifyLiteArg) (res keybase1.IdentifyLiteRes, err error) {
	h.G().Log.CDebugf(netCtx, "IdentifyLite on user")

	var uid keybase1.UID
	if arg.Id.Exists() {
		uid, err = arg.Id.AsUser()
		if err != nil {
			return res, err
		}
	}

	id2arg := keybase1.Identify2Arg{
		SessionID:             arg.SessionID,
		Uid:                   uid,
		UserAssertion:         arg.Assertion,
		Reason:                arg.Reason,
		UseDelegateUI:         arg.UseDelegateUI,
		AlwaysBlock:           arg.AlwaysBlock,
		NoErrorOnTrackFailure: arg.NoErrorOnTrackFailure,
		ForceRemoteCheck:      arg.ForceRemoteCheck,
		NeedProofSet:          arg.NeedProofSet,
		AllowEmptySelfID:      arg.AllowEmptySelfID,
		NoSkipSelf:            arg.NoSkipSelf,
		CanSuppressUI:         arg.CanSuppressUI,
		IdentifyBehavior:      arg.IdentifyBehavior,
		ForceDisplay:          arg.ForceDisplay,
	}

	iui := h.NewRemoteIdentifyUI(arg.SessionID, h.G())
	logui := h.getLogUI(arg.SessionID)
	ctx := engine.Context{
		LogUI:      logui,
		IdentifyUI: iui,
		SessionID:  arg.SessionID,
		NetContext: netCtx,
	}

	eng := engine.NewResolveThenIdentify2(h.G(), &id2arg)
	err = engine.RunEngine(eng, &ctx)
	resp := eng.Result()
	if resp != nil {
		res.Ul.Id = keybase1.UserOrTeamID(resp.Upk.Uid)
		res.Ul.Name = resp.Upk.Username
	}
	res.TrackBreaks = resp.TrackBreaks
	return res, err
}

func (h *IdentifyHandler) Resolve(ctx context.Context, arg string) (uid keybase1.UID, err error) {
	ctx = libkb.WithLogTag(ctx, "RSLV")
	defer h.G().CTrace(ctx, fmt.Sprintf("IdentifyHandler#Resolve(%s)", arg), func() error { return err })()
	rres := h.G().Resolver.ResolveFullExpression(ctx, arg)
	return rres.GetUID(), rres.GetError()
}

func (h *IdentifyHandler) Resolve2(ctx context.Context, arg string) (u keybase1.User, err error) {
	ctx = libkb.WithLogTag(ctx, "RSLV")
	defer h.G().CTrace(ctx, fmt.Sprintf("IdentifyHandler#Resolve2(%s)", arg), func() error { return err })()
	res := h.G().Resolver.ResolveFullExpressionNeedUsername(ctx, arg)
	err = res.GetError()
	if err != nil {
		return keybase1.User{}, err
	}

	return res.User(), nil
}

func (h *IdentifyHandler) Resolve3(ctx context.Context, arg string) (u keybase1.UserOrTeamLite, err error) {
	ctx = libkb.WithLogTag(ctx, "RSLV")
	defer h.G().CTrace(ctx, fmt.Sprintf("IdentifyHandler#Resolve3(%s)", arg), func() error { return err })()
	return h.resolveUserOrTeam(ctx, arg)
}

func (h *IdentifyHandler) resolveUserOrTeam(ctx context.Context, arg string) (u keybase1.UserOrTeamLite, err error) {

	res := h.G().Resolver.ResolveFullExpressionNeedUsername(ctx, arg)
	err = res.GetError()
	if err != nil {
		return u, err
	}
	return res.UserOrTeam(), nil
}

func (h *IdentifyHandler) Identify(_ context.Context, arg keybase1.IdentifyArg) (res keybase1.IdentifyRes, err error) {
	h.G().Log.Info("deprecated keybase1.Identify v1 called")
	return res, errors.New("keybase1.Identify no longer supported")
}

func (u *RemoteIdentifyUI) newContext() (context.Context, func()) {
	return context.WithTimeout(context.Background(), libkb.RemoteIdentifyUITimeout)
}

func (u *RemoteIdentifyUI) FinishWebProofCheck(p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.FinishWebProofCheck(ctx, keybase1.FinishWebProofCheckArg{
		SessionID: u.sessionID,
		Rp:        p,
		Lcr:       lcr,
	})
}

func (u *RemoteIdentifyUI) FinishSocialProofCheck(p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.FinishSocialProofCheck(ctx, keybase1.FinishSocialProofCheckArg{
		SessionID: u.sessionID,
		Rp:        p,
		Lcr:       lcr,
	})
}

func (u *RemoteIdentifyUI) Confirm(io *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	if u.skipPrompt {
		u.G().Log.Debug("skipping Confirm for %q", io.Username)
		return keybase1.ConfirmResult{IdentityConfirmed: true}, nil
	}
	return u.uicli.Confirm(context.TODO(), keybase1.ConfirmArg{SessionID: u.sessionID, Outcome: *io})
}

func (u *RemoteIdentifyUI) DisplayCryptocurrency(c keybase1.Cryptocurrency) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.DisplayCryptocurrency(ctx, keybase1.DisplayCryptocurrencyArg{SessionID: u.sessionID, C: c})
}

func (u *RemoteIdentifyUI) DisplayKey(key keybase1.IdentifyKey) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.DisplayKey(ctx, keybase1.DisplayKeyArg{SessionID: u.sessionID, Key: key})
}

func (u *RemoteIdentifyUI) ReportLastTrack(t *keybase1.TrackSummary) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.ReportLastTrack(ctx, keybase1.ReportLastTrackArg{SessionID: u.sessionID, Track: t})
}

func (u *RemoteIdentifyUI) DisplayTrackStatement(s string) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.DisplayTrackStatement(ctx, keybase1.DisplayTrackStatementArg{Stmt: s, SessionID: u.sessionID})
}

func (u *RemoteIdentifyUI) ReportTrackToken(token keybase1.TrackToken) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.ReportTrackToken(ctx, keybase1.ReportTrackTokenArg{TrackToken: token, SessionID: u.sessionID})
}

func (u *RemoteIdentifyUI) LaunchNetworkChecks(id *keybase1.Identity, user *keybase1.User) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.LaunchNetworkChecks(ctx, keybase1.LaunchNetworkChecksArg{
		SessionID: u.sessionID,
		Identity:  *id,
		User:      *user,
	})
}

func (u *RemoteIdentifyUI) DisplayUserCard(card keybase1.UserCard) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.DisplayUserCard(ctx, keybase1.DisplayUserCardArg{SessionID: u.sessionID, Card: card})
}

func (u *RemoteIdentifyUI) Start(username string, reason keybase1.IdentifyReason, force bool) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.Start(ctx, keybase1.StartArg{SessionID: u.sessionID, Username: username, Reason: reason, ForceDisplay: force})
}

func (u *RemoteIdentifyUI) Cancel() error {
	if u.uicli.Cli == nil {
		return nil
	}
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.Cancel(ctx, u.sessionID)
}

func (u *RemoteIdentifyUI) Finish() error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.Finish(ctx, u.sessionID)
}

func (u *RemoteIdentifyUI) Dismiss(username string, reason keybase1.DismissReason) error {
	ctx, cancel := u.newContext()
	defer cancel()
	return u.uicli.Dismiss(ctx, keybase1.DismissArg{
		SessionID: u.sessionID,
		Username:  username,
		Reason:    reason,
	})
}

func (u *RemoteIdentifyUI) SetStrict(b bool) {
	u.strict = b
}

func (u *RemoteIdentifyUI) DisplayTLFCreateWithInvite(arg keybase1.DisplayTLFCreateWithInviteArg) error {
	ctx, cancel := u.newContext()
	defer cancel()
	arg.SessionID = u.sessionID
	return u.uicli.DisplayTLFCreateWithInvite(ctx, arg)
}

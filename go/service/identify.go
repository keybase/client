// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"time"

	"github.com/golang/groupcache/singleflight"
	"golang.org/x/net/context"
	"stathat.com/c/ramcache"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
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
	resultCache *ramcache.Ramcache
	callGroup   singleflight.Group
}

func NewIdentifyHandler(xp rpc.Transporter, g *libkb.GlobalContext) *IdentifyHandler {
	c := ramcache.New()
	c.TTL = 5 * time.Minute
	c.MaxAge = 5 * time.Minute

	return &IdentifyHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		resultCache:  c,
	}
}

func (h *IdentifyHandler) Identify2(_ context.Context, arg keybase1.Identify2Arg) (res keybase1.Identify2Res, err error) {
	defer h.G().Trace("IdentifyHandler.Identify2", func() error { return err })()
	iui := h.NewRemoteIdentifyUI(arg.SessionID, h.G())
	logui := h.getLogUI(arg.SessionID)
	ctx := engine.Context{
		LogUI:      logui,
		IdentifyUI: iui,
		SessionID:  arg.SessionID,
	}
	eng := engine.NewResolveThenIdentify2(h.G(), &arg)
	err = engine.RunEngine(eng, &ctx)
	resp := eng.Result()
	if resp != nil {
		res = *resp
	}
	return res, err
}

func (h *IdentifyHandler) Resolve(_ context.Context, arg string) (uid keybase1.UID, err error) {
	defer h.G().Trace(fmt.Sprintf("IdentifyHandler.Resolve(%s)", arg), func() error { return err })()
	rres := h.G().Resolver.ResolveFullExpression(arg)
	return rres.GetUID(), rres.GetError()
}

func (h *IdentifyHandler) Resolve2(_ context.Context, arg string) (u keybase1.User, err error) {
	defer h.G().Trace(fmt.Sprintf("IdentifyHandler.Resolve2(%s)", arg), func() error { return err })()
	rres := h.G().Resolver.ResolveFullExpressionNeedUsername(arg)
	err = rres.GetError()
	if err == nil {
		u.Uid, u.Username = rres.GetUID(), rres.GetNormalizedUsername().String()
	}
	return u, err
}

func (h *IdentifyHandler) Identify(_ context.Context, arg keybase1.IdentifyArg) (res keybase1.IdentifyRes, err error) {
	defer h.G().Trace("IdentifyHandler.Identify", func() error { return err })()
	var do = func() (interface{}, error) {
		if arg.Source == keybase1.ClientType_KBFS {
			h.G().Log.Debug("KBFS Identify: checking result cache for %q", arg.UserAssertion)
			x, err := h.resultCache.Get(arg.UserAssertion)
			if err == nil {
				exp, ok := x.(*keybase1.IdentifyRes)
				if ok {
					h.G().Log.Debug("KBFS Identify: found cached result for %q", arg.UserAssertion)
					return *exp, nil
				}
			}
			h.G().Log.Debug("KBFS Identify: no cached result for %q", arg.UserAssertion)
		}

		res, err := h.identify(arg.SessionID, arg)
		if err != nil {
			return keybase1.IdentifyRes{}, err
		}
		exp := res.Export()

		if len(arg.UserAssertion) > 0 {
			if err := h.resultCache.Set(arg.UserAssertion, exp); err != nil {
				h.G().Log.Debug("Identify: result cache set error: %s", err)
			} else {
				h.G().Log.Debug("Identify: storing result for %q in result cache", arg.UserAssertion)
			}
		}

		return *exp, nil
	}

	// If there is already an identify in progress for arg.UserAssertion, using callGroup here will
	// just wait for that one to finish and use its result instead of spawning a concurrent identify
	// call for the same user assertion.
	v, err := h.callGroup.Do(arg.UserAssertion, do)
	if err != nil {
		return keybase1.IdentifyRes{}, err
	}
	res, ok := v.(keybase1.IdentifyRes)
	if !ok {
		return keybase1.IdentifyRes{}, fmt.Errorf("invalid type returned by do: %T", v)
	}

	return res, nil
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

	ctx := engine.Context{
		LogUI:      logui,
		IdentifyUI: iui,
		SessionID:  sessionID,
	}
	return &ctx, nil
}

func (h *IdentifyHandler) identify(sessionID int, arg keybase1.IdentifyArg) (res *engine.IDRes, err error) {
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

func (u *RemoteIdentifyUI) ReportTrackToken(token keybase1.TrackToken) error {
	return u.uicli.ReportTrackToken(context.TODO(), keybase1.ReportTrackTokenArg{TrackToken: token, SessionID: u.sessionID})
}

func (u *RemoteIdentifyUI) LaunchNetworkChecks(id *keybase1.Identity, user *keybase1.User) {
	u.uicli.LaunchNetworkChecks(context.TODO(), keybase1.LaunchNetworkChecksArg{
		SessionID: u.sessionID,
		Identity:  *id,
		User:      *user,
	})
	return
}

func (u *RemoteIdentifyUI) DisplayUserCard(card keybase1.UserCard) {
	u.uicli.DisplayUserCard(context.TODO(), keybase1.DisplayUserCardArg{SessionID: u.sessionID, Card: card})
	return
}

func (u *RemoteIdentifyUI) Start(username string, reason keybase1.IdentifyReason) {
	u.uicli.Start(context.TODO(), keybase1.StartArg{SessionID: u.sessionID, Username: username, Reason: reason})
}

func (u *RemoteIdentifyUI) Finish() {
	u.uicli.Finish(context.TODO(), u.sessionID)
}

func (u *RemoteIdentifyUI) Dismiss(uid keybase1.UID, reason keybase1.DismissReason) {
	u.uicli.Dismiss(context.TODO(), keybase1.DismissArg{
		SessionID: u.sessionID,
		Uid:       uid,
		Reason:    reason,
	})
}

func (u *RemoteIdentifyUI) SetStrict(b bool) {
	u.strict = b
}

func (u *RemoteIdentifyUI) DisplayTLFCreateWithInvite(arg keybase1.DisplayTLFCreateWithInviteArg) error {
	arg.SessionID = u.sessionID
	return u.uicli.DisplayTLFCreateWithInvite(context.TODO(), arg)
}

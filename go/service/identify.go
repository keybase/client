// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"sync"

	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
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
	return &IdentifyHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *IdentifyHandler) Identify2(netCtx context.Context, arg keybase1.Identify2Arg) (res keybase1.Identify2Res, err error) {
	netCtx = libkb.WithLogTag(netCtx, "ID2")
	m := libkb.NewMetaContext(netCtx, h.G())
	defer h.G().CTrace(netCtx, "IdentifyHandler#Identify2", func() error { return err })()

	iui := h.NewRemoteIdentifyUI(arg.SessionID, h.G())
	logui := h.getLogUI(arg.SessionID)
	uis := libkb.UIs{
		LogUI:      logui,
		IdentifyUI: iui,
		SessionID:  arg.SessionID,
	}
	m = m.WithUIs(uis)
	eng := engine.NewResolveThenIdentify2(h.G(), &arg)
	err = engine.RunEngine2(m, eng)
	if err != nil {
		return res, err
	}
	resp, err := eng.Result()
	if err != nil {
		return res, err
	}
	if resp != nil {
		res = resp.ExportToV1()
	}
	return res, err
}

func (h *IdentifyHandler) IdentifyLite(netCtx context.Context, arg keybase1.IdentifyLiteArg) (res keybase1.IdentifyLiteRes, err error) {
	netCtx = libkb.WithLogTag(netCtx, "IDL")
	defer h.G().CTrace(netCtx, "IdentifyHandler#IdentifyLite", func() error { return err })()

	var au libkb.AssertionURL
	var parseError error
	if len(arg.Assertion) > 0 {
		// It's OK to fail this assertion; it will be off in the case of regular lookups
		// for users like `t_ellen` without a `type` specification
		au, parseError = libkb.ParseAssertionURL(h.G().MakeAssertionContext(), arg.Assertion, true)
	} else {
		// empty assertion url required for teams.IdentifyLite
		au = libkb.AssertionKeybase{}
	}

	if arg.Id.IsTeamOrSubteam() || libkb.AssertionIsTeam(au) {
		// Now heed the parse error.
		if parseError != nil {
			return res, parseError
		}
		return teams.IdentifyLite(netCtx, h.G(), arg, au)
	}

	return h.identifyLiteUser(netCtx, arg)
}

func (h *IdentifyHandler) identifyLiteUser(netCtx context.Context, arg keybase1.IdentifyLiteArg) (res keybase1.IdentifyLiteRes, err error) {
	m := libkb.NewMetaContext(netCtx, h.G())
	m.CDebugf("IdentifyLite on user")

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
	uis := libkb.UIs{
		LogUI:      logui,
		IdentifyUI: iui,
		SessionID:  arg.SessionID,
	}
	m = m.WithUIs(uis)
	eng := engine.NewResolveThenIdentify2(h.G(), &id2arg)
	err = engine.RunEngine2(m, eng)
	if err != nil {
		return res, err
	}
	resp, err := eng.Result()
	if err != nil {
		return res, err
	}
	res.Ul.Id = keybase1.UserOrTeamID(resp.Upk.GetUID())
	res.Ul.Name = resp.Upk.GetName()
	res.TrackBreaks = resp.TrackBreaks
	return res, err
}

func (h *IdentifyHandler) Resolve3(ctx context.Context, arg string) (u keybase1.UserOrTeamLite, err error) {
	ctx = libkb.WithLogTag(ctx, "RSLV")
	defer h.G().CTrace(ctx, fmt.Sprintf("IdentifyHandler#Resolve3(%s)", arg), func() error { return err })()
	return h.resolveUserOrTeam(ctx, arg)
}

func (h *IdentifyHandler) resolveUserOrTeam(ctx context.Context, arg string) (u keybase1.UserOrTeamLite, err error) {

	res := h.G().Resolver.ResolveFullExpressionNeedUsername(libkb.NewMetaContext(ctx, h.G()), arg)
	err = res.GetError()
	if err != nil {
		return u, err
	}
	return res.UserOrTeam(), nil
}

func (h *IdentifyHandler) ResolveIdentifyImplicitTeam(ctx context.Context, arg keybase1.ResolveIdentifyImplicitTeamArg) (res keybase1.ResolveIdentifyImplicitTeamRes, err error) {
	ctx = libkb.WithLogTag(ctx, "RIIT")
	defer h.G().CTrace(ctx, fmt.Sprintf("IdentifyHandler#ResolveIdentifyImplicitTeam(%+v)", arg), func() error { return err })()

	h.G().Log.CDebugf(ctx, "ResolveIdentifyImplicitTeam assertions:'%v'", arg.Assertions)

	writerAssertions, readerAssertions, err := externals.ParseAssertionsWithReaders(h.G(), arg.Assertions)
	if err != nil {
		return res, err
	}
	return h.resolveIdentifyImplicitTeamHelper(ctx, arg, writerAssertions, readerAssertions)
}

func (h *IdentifyHandler) resolveIdentifyImplicitTeamHelper(ctx context.Context, arg keybase1.ResolveIdentifyImplicitTeamArg,
	writerAssertions, readerAssertions []libkb.AssertionExpression) (res keybase1.ResolveIdentifyImplicitTeamRes, err error) {

	lookupName := keybase1.ImplicitTeamDisplayName{
		IsPublic: arg.IsPublic,
	}
	if len(arg.Suffix) > 0 {
		lookupName.ConflictInfo, err = libkb.ParseImplicitTeamDisplayNameSuffix(arg.Suffix)
		if err != nil {
			return res, err
		}
	}

	var resolvedAssertions []libkb.ResolvedAssertion

	err = teams.ResolveImplicitTeamSetUntrusted(ctx, h.G(), writerAssertions, &lookupName.Writers, &resolvedAssertions)
	if err != nil {
		return res, err
	}
	err = teams.ResolveImplicitTeamSetUntrusted(ctx, h.G(), readerAssertions, &lookupName.Readers, &resolvedAssertions)
	if err != nil {
		return res, err
	}

	lookupNameStr, err := teams.FormatImplicitTeamDisplayName(ctx, h.G(), lookupName)
	if err != nil {
		return res, err
	}
	h.G().Log.CDebugf(ctx, "ResolveIdentifyImplicitTeam looking up:'%v'", lookupNameStr)

	var team *teams.Team
	var impName keybase1.ImplicitTeamDisplayName
	// Lookup*ImplicitTeam is responsible for making sure the returned team has the members from lookupName.
	// Duplicates are also handled by Lookup*. So we might end up doing extra identifies of duplicates out here.
	// (Duplicates e.g. "me,chris,chris", "me,chris#chris", "me,chris@rooter#chris")
	if arg.Create {
		team, _, impName, err = teams.LookupOrCreateImplicitTeam(ctx, h.G(), lookupNameStr, arg.IsPublic)
	} else {
		team, _, impName, err = teams.LookupImplicitTeam(ctx, h.G(), lookupNameStr, arg.IsPublic)
	}
	if err != nil {
		return res, err
	}

	// can be nil
	myUID := h.G().ActiveDevice.UID()

	var displayNameKBFS string
	if myUID.Exists() {
		var name libkb.NormalizedUsername
		name, err = h.G().GetUPAKLoader().LookupUsername(ctx, myUID)
		if err != nil {
			return res, err
		}
		// display name with the logged-in user first
		displayNameKBFS, err = teams.FormatImplicitTeamDisplayNameWithUserFront(ctx, h.G(), impName, name)
	} else {
		displayNameKBFS, err = teams.FormatImplicitTeamDisplayName(ctx, h.G(), impName)
	}
	if err != nil {
		return res, err
	}

	writers, err := team.UsersWithRoleOrAbove(keybase1.TeamRole_WRITER)
	if err != nil {
		return res, err
	}

	// Populate the result. It may get returned together with an identify error.
	res = keybase1.ResolveIdentifyImplicitTeamRes{
		DisplayName: displayNameKBFS,
		TeamID:      team.ID,
		Writers:     writers,
		TrackBreaks: nil,
		FolderID:    team.KBFSTLFID(),
	}

	if arg.DoIdentifies {
		return h.resolveIdentifyImplicitTeamDoIdentifies(ctx, arg, res, resolvedAssertions)
	}
	return res, nil
}

func (h *IdentifyHandler) resolveIdentifyImplicitTeamDoIdentifies(ctx context.Context, arg keybase1.ResolveIdentifyImplicitTeamArg,
	res keybase1.ResolveIdentifyImplicitTeamRes, resolvedAssertions []libkb.ResolvedAssertion) (keybase1.ResolveIdentifyImplicitTeamRes, error) {

	// errgroup collects errors and returns the first non-nil.
	// subctx is canceled when the group finishes.
	group, subctx := errgroup.WithContext(ctx)

	// lock guarding res.TrackBreaks
	var trackBreaksLock sync.Mutex

	// Identify everyone who resolved in parallel, checking that they match their resolved UID and original assertions.
	for _, resolvedAssertion := range resolvedAssertions {
		resolvedAssertion := resolvedAssertion // https://golang.org/doc/faq#closures_and_goroutines
		group.Go(func() error {
			h.G().Log.CDebugf(ctx, "ResolveIdentifyImplicitTeam ID user [%s] %s", resolvedAssertion.UID, resolvedAssertion.Assertion.String())

			id2arg := keybase1.Identify2Arg{
				SessionID:             arg.SessionID,
				Uid:                   resolvedAssertion.UID,
				UserAssertion:         resolvedAssertion.Assertion.String(),
				Reason:                arg.Reason,
				UseDelegateUI:         true,
				AlwaysBlock:           false,
				NoErrorOnTrackFailure: false,
				ForceRemoteCheck:      false,
				NeedProofSet:          false,
				AllowEmptySelfID:      false,
				NoSkipSelf:            false,
				CanSuppressUI:         true,
				IdentifyBehavior:      arg.IdentifyBehavior,
				ForceDisplay:          false,
			}

			iui := h.NewRemoteIdentifyUI(arg.SessionID, h.G())
			logui := h.getLogUI(arg.SessionID)
			uis := libkb.UIs{
				LogUI:      logui,
				IdentifyUI: iui,
				SessionID:  arg.SessionID,
			}

			eng := engine.NewIdentify2WithUID(h.G(), &id2arg)
			m := libkb.NewMetaContext(subctx, h.G()).WithUIs(uis)
			err := engine.RunEngine2(m, eng)
			idRes, idErr := eng.Result()
			if err != nil {
				h.G().Log.CDebugf(subctx, "identify failed (IDres %v, TrackBreaks %v): %v", idRes != nil, idRes != nil && idRes.TrackBreaks != nil, err)
				if idRes != nil && idRes.TrackBreaks != nil && idErr == nil {
					trackBreaksLock.Lock()
					defer trackBreaksLock.Unlock()
					if res.TrackBreaks == nil {
						res.TrackBreaks = make(map[keybase1.UserVersion]keybase1.IdentifyTrackBreaks)
					}
					res.TrackBreaks[idRes.Upk.ToUserVersion()] = *idRes.TrackBreaks
				}
				if idErr != nil {
					h.G().Log.CDebugf(subctx, "Failed to convert result from Identify2: %s", idErr)
				}
				return err
			}
			return nil
		})
	}

	err := group.Wait()
	if err != nil {
		// Return the masked error together with a populated response.
		return res, libkb.NewIdentifiesFailedError()
	}
	return res, err
}

func (h *IdentifyHandler) ResolveImplicitTeam(ctx context.Context, arg keybase1.ResolveImplicitTeamArg) (res keybase1.Folder, err error) {
	ctx = libkb.WithLogTag(ctx, "RIT")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("ResolveImplicitTeam(%s)", arg.Id), func() error { return err })()
	return teams.MapImplicitTeamIDToDisplayName(ctx, h.G(), arg.Id, arg.Id.IsPublic())
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

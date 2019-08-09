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
	"github.com/keybase/client/go/offline"
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

var _ libkb.IdentifyUI = (*RemoteIdentifyUI)(nil)

type IdentifyHandler struct {
	*BaseHandler
	libkb.Contextified
	service *Service
}

func NewIdentifyHandler(xp rpc.Transporter, g *libkb.GlobalContext, s *Service) *IdentifyHandler {
	return &IdentifyHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
		service:      s,
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
	resp, err := eng.Result(m)
	if err != nil {
		return res, err
	}
	if resp != nil {
		res = resp.ExportToV1()
	}
	return res, err
}

func (h *IdentifyHandler) IdentifyLite(netCtx context.Context, arg keybase1.IdentifyLiteArg) (ret keybase1.IdentifyLiteRes, err error) {
	mctx := libkb.NewMetaContext(netCtx, h.G()).WithLogTag("IDL")
	defer mctx.Trace("IdentifyHandler#IdentifyLite", func() error { return err })()
	loader := func(mctx libkb.MetaContext) (interface{}, error) {
		return h.identifyLite(mctx, arg)
	}
	cacheArg := keybase1.IdentifyLiteArg{
		Id:               arg.Id,
		Assertion:        arg.Assertion,
		IdentifyBehavior: arg.IdentifyBehavior,
	}
	servedRet, err := h.service.offlineRPCCache.Serve(mctx, arg.Oa, offline.Version(1), "identify.identifyLite", false, cacheArg, &ret, loader)
	if err != nil {
		return servedRet.(keybase1.IdentifyLiteRes), err
	}
	if s, ok := servedRet.(keybase1.IdentifyLiteRes); ok {
		ret = s
	}
	return ret, nil
}

func (h *IdentifyHandler) identifyLite(mctx libkb.MetaContext, arg keybase1.IdentifyLiteArg) (res keybase1.IdentifyLiteRes, err error) {

	var au libkb.AssertionURL
	var parseError error
	if len(arg.Assertion) > 0 {
		// It's OK to fail this assertion; it will be off in the case of regular lookups
		// for users like `t_ellen` without a `type` specification
		au, parseError = libkb.ParseAssertionURL(mctx.G().MakeAssertionContext(mctx), arg.Assertion, true)
	} else {
		// empty assertion url required for teams.IdentifyLite
		au = libkb.AssertionKeybase{}
	}

	if arg.Id.IsTeamOrSubteam() || libkb.AssertionIsTeam(au) {
		// Now heed the parse error.
		if parseError != nil {
			return res, parseError
		}
		return teams.IdentifyLite(mctx.Ctx(), mctx.G(), arg, au)
	}

	return h.identifyLiteUser(mctx.Ctx(), arg)
}

func (h *IdentifyHandler) identifyLiteUser(netCtx context.Context, arg keybase1.IdentifyLiteArg) (res keybase1.IdentifyLiteRes, err error) {
	m := libkb.NewMetaContext(netCtx, h.G())
	m.Debug("IdentifyLite on user")

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
	resp, err := eng.Result(m)
	if err != nil {
		return res, err
	}
	res.Ul.Id = keybase1.UserOrTeamID(resp.Upk.GetUID())
	res.Ul.Name = resp.Upk.GetName()
	res.TrackBreaks = resp.TrackBreaks
	return res, err
}

func (h *IdentifyHandler) Resolve3(ctx context.Context, arg keybase1.Resolve3Arg) (ret keybase1.UserOrTeamLite, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("RSLV")
	defer mctx.Trace(fmt.Sprintf("IdentifyHandler#Resolve3(%+v)", arg), func() error { return err })()
	servedRet, err := h.service.offlineRPCCache.Serve(mctx, arg.Oa, offline.Version(1), "identify.resolve3", false, arg, &ret, func(mctx libkb.MetaContext) (interface{}, error) {
		return h.resolveUserOrTeam(mctx.Ctx(), arg.Assertion)
	})
	if err != nil {
		return keybase1.UserOrTeamLite{}, err
	}
	if s, ok := servedRet.(keybase1.UserOrTeamLite); ok {
		ret = s
	}
	return ret, nil
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
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("RIIT")
	defer mctx.Trace(fmt.Sprintf("IdentifyHandler#ResolveIdentifyImplicitTeam(%+v)", arg), func() error { return err })()

	writerAssertions, readerAssertions, err := externals.ParseAssertionsWithReaders(h.MetaContext(ctx), arg.Assertions)
	if err != nil {
		return res, err
	}

	cacheArg := keybase1.ResolveIdentifyImplicitTeamArg{
		Assertions: arg.Assertions,
		Suffix:     arg.Suffix,
		IsPublic:   arg.IsPublic,
	}

	servedRes, err := h.service.offlineRPCCache.Serve(mctx, arg.Oa, offline.Version(1), "identify.resolveIdentifyImplicitTeam", false, cacheArg, &res, func(mctx libkb.MetaContext) (interface{}, error) {
		return h.resolveIdentifyImplicitTeamHelper(mctx.Ctx(), arg, writerAssertions, readerAssertions)
	})

	if s, ok := servedRes.(keybase1.ResolveIdentifyImplicitTeamRes); ok {
		// We explicitly want to return `servedRes` here, when err !=
		// nil, as the caller might depend on it in certain cases.
		res = s
	} else if err != nil {
		res = keybase1.ResolveIdentifyImplicitTeamRes{}
	}
	mctx.Debug("res: {displayName: %s, teamID: %s, folderID: %s}", res.DisplayName, res.TeamID, res.FolderID)
	return res, err
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
		team, _, impName, err = teams.LookupImplicitTeam(ctx, h.G(), lookupNameStr, arg.IsPublic, teams.ImplicitTeamOptions{})
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
		FolderID:    team.LatestKBFSTLFID(),
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

	var okUsernames, brokenUsernames []string

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
			idRes, idErr := eng.Result(m)
			if idErr != nil {
				h.G().Log.CDebugf(subctx, "Failed to convert result from Identify2: %s", idErr)
			}
			if idRes != nil && idRes.TrackBreaks != nil && idErr == nil {
				trackBreaksLock.Lock()
				defer trackBreaksLock.Unlock()
				if res.TrackBreaks == nil {
					res.TrackBreaks = make(map[keybase1.UserVersion]keybase1.IdentifyTrackBreaks)
				}
				res.TrackBreaks[idRes.Upk.ToUserVersion()] = *idRes.TrackBreaks
				brokenUsernames = append(brokenUsernames, idRes.Upk.GetName())
			} else {
				okUsernames = append(okUsernames, idRes.Upk.GetName())
			}
			if err != nil {
				h.G().Log.CDebugf(subctx, "identify failed (IDres %v, TrackBreaks %v): %v", idRes != nil, idRes != nil && idRes.TrackBreaks != nil, err)
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

	if arg.IdentifyBehavior.NotifyGUIAboutBreaks() && len(res.TrackBreaks) > 0 {
		h.G().NotifyRouter.HandleIdentifyUpdate(ctx, okUsernames, brokenUsernames)
	}

	return res, err
}

func (h *IdentifyHandler) ResolveImplicitTeam(ctx context.Context, arg keybase1.ResolveImplicitTeamArg) (res keybase1.Folder, err error) {
	ctx = libkb.WithLogTag(ctx, "RIT")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("ResolveImplicitTeam(%s)", arg.Id), func() error { return err })()
	return teams.MapImplicitTeamIDToDisplayName(ctx, h.G(), arg.Id, arg.Id.IsPublic())
}

func (h *IdentifyHandler) NormalizeSocialAssertion(ctx context.Context, assertion string) (socialAssertion keybase1.SocialAssertion, err error) {
	ctx = libkb.WithLogTag(ctx, "NSA")
	defer h.G().CTrace(ctx, fmt.Sprintf("IdentifyHandler#NormalizeSocialAssertion(%s)", assertion), func() error { return err })()
	socialAssertion, isSocialAssertion := libkb.NormalizeSocialAssertion(h.G().MakeAssertionContext(h.MetaContext(ctx)), assertion)
	if !isSocialAssertion {
		return keybase1.SocialAssertion{}, fmt.Errorf("Invalid social assertion")
	}
	return socialAssertion, nil
}

func (u *RemoteIdentifyUI) newMetaContext(mctx libkb.MetaContext) (libkb.MetaContext, func()) {
	return mctx.WithTimeout(libkb.RemoteIdentifyUITimeout)
}

func (u *RemoteIdentifyUI) FinishWebProofCheck(mctx libkb.MetaContext, p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.FinishWebProofCheck(mctx.Ctx(), keybase1.FinishWebProofCheckArg{
		SessionID: u.sessionID,
		Rp:        p,
		Lcr:       lcr,
	})
}

func (u *RemoteIdentifyUI) FinishSocialProofCheck(mctx libkb.MetaContext, p keybase1.RemoteProof, lcr keybase1.LinkCheckResult) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.FinishSocialProofCheck(mctx.Ctx(), keybase1.FinishSocialProofCheckArg{
		SessionID: u.sessionID,
		Rp:        p,
		Lcr:       lcr,
	})
}

func (u *RemoteIdentifyUI) Confirm(mctx libkb.MetaContext, io *keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	if u.skipPrompt {
		mctx.Debug("skipping Confirm for %q", io.Username)
		return keybase1.ConfirmResult{IdentityConfirmed: true}, nil
	}
	return u.uicli.Confirm(mctx.Ctx(), keybase1.ConfirmArg{SessionID: u.sessionID, Outcome: *io})
}

func (u *RemoteIdentifyUI) DisplayCryptocurrency(mctx libkb.MetaContext, c keybase1.Cryptocurrency) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.DisplayCryptocurrency(mctx.Ctx(), keybase1.DisplayCryptocurrencyArg{SessionID: u.sessionID, C: c})
}

func (u *RemoteIdentifyUI) DisplayStellarAccount(mctx libkb.MetaContext, a keybase1.StellarAccount) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.DisplayStellarAccount(mctx.Ctx(), keybase1.DisplayStellarAccountArg{SessionID: u.sessionID, A: a})
}

func (u *RemoteIdentifyUI) DisplayKey(mctx libkb.MetaContext, key keybase1.IdentifyKey) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.DisplayKey(mctx.Ctx(), keybase1.DisplayKeyArg{SessionID: u.sessionID, Key: key})
}

func (u *RemoteIdentifyUI) ReportLastTrack(mctx libkb.MetaContext, t *keybase1.TrackSummary) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.ReportLastTrack(mctx.Ctx(), keybase1.ReportLastTrackArg{SessionID: u.sessionID, Track: t})
}

func (u *RemoteIdentifyUI) DisplayTrackStatement(mctx libkb.MetaContext, s string) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.DisplayTrackStatement(mctx.Ctx(), keybase1.DisplayTrackStatementArg{Stmt: s, SessionID: u.sessionID})
}

func (u *RemoteIdentifyUI) ReportTrackToken(mctx libkb.MetaContext, token keybase1.TrackToken) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.ReportTrackToken(mctx.Ctx(), keybase1.ReportTrackTokenArg{TrackToken: token, SessionID: u.sessionID})
}

func (u *RemoteIdentifyUI) LaunchNetworkChecks(mctx libkb.MetaContext, id *keybase1.Identity, user *keybase1.User) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.LaunchNetworkChecks(mctx.Ctx(), keybase1.LaunchNetworkChecksArg{
		SessionID: u.sessionID,
		Identity:  *id,
		User:      *user,
	})
}

func (u *RemoteIdentifyUI) DisplayUserCard(mctx libkb.MetaContext, card keybase1.UserCard) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.DisplayUserCard(mctx.Ctx(), keybase1.DisplayUserCardArg{SessionID: u.sessionID, Card: card})
}

func (u *RemoteIdentifyUI) Start(mctx libkb.MetaContext, username string, reason keybase1.IdentifyReason, force bool) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.Start(mctx.Ctx(), keybase1.StartArg{SessionID: u.sessionID, Username: username, Reason: reason, ForceDisplay: force})
}

func (u *RemoteIdentifyUI) Cancel(mctx libkb.MetaContext) error {
	if u.uicli.Cli == nil {
		return nil
	}
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.Cancel(mctx.Ctx(), u.sessionID)
}

func (u *RemoteIdentifyUI) Finish(mctx libkb.MetaContext) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.Finish(mctx.Ctx(), u.sessionID)
}

func (u *RemoteIdentifyUI) Dismiss(mctx libkb.MetaContext, username string, reason keybase1.DismissReason) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	return u.uicli.Dismiss(mctx.Ctx(), keybase1.DismissArg{
		SessionID: u.sessionID,
		Username:  username,
		Reason:    reason,
	})
}

func (u *RemoteIdentifyUI) SetStrict(b bool) {
	u.strict = b
}

func (u *RemoteIdentifyUI) DisplayTLFCreateWithInvite(mctx libkb.MetaContext, arg keybase1.DisplayTLFCreateWithInviteArg) error {
	mctx, cancel := u.newMetaContext(mctx)
	defer cancel()
	arg.SessionID = u.sessionID
	return u.uicli.DisplayTLFCreateWithInvite(mctx.Ctx(), arg)
}

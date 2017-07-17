// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// UserHandler is the RPC handler for the user interface.
type UserHandler struct {
	*BaseHandler
	libkb.Contextified
	globals.ChatContextified
}

// NewUserHandler creates a UserHandler for the xp transport.
func NewUserHandler(xp rpc.Transporter, g *libkb.GlobalContext, chatG *globals.ChatContext) *UserHandler {
	return &UserHandler{
		BaseHandler:      NewBaseHandler(xp),
		Contextified:     libkb.NewContextified(g),
		ChatContextified: globals.NewChatContextified(chatG),
	}
}

// ListTrackers gets the list of trackers for a user by uid.
func (h *UserHandler) ListTrackers(_ context.Context, arg keybase1.ListTrackersArg) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackers(arg.Uid, h.G())
	return h.listTrackers(arg.SessionID, eng)
}

// ListTrackersByName gets the list of trackers for a user by
// username.
func (h *UserHandler) ListTrackersByName(_ context.Context, arg keybase1.ListTrackersByNameArg) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersByName(arg.Username)
	return h.listTrackers(arg.SessionID, eng)
}

// ListTrackersSelf gets the list of trackers for the logged in
// user.
func (h *UserHandler) ListTrackersSelf(_ context.Context, sessionID int) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersSelf()
	return h.listTrackers(sessionID, eng)
}

func (h *UserHandler) listTrackers(sessionID int, eng *engine.ListTrackersEngine) ([]keybase1.Tracker, error) {
	ctx := &engine.Context{
		LogUI:     h.getLogUI(sessionID),
		SessionID: sessionID,
	}
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	res := eng.ExportedList()
	return res, nil
}

func (h *UserHandler) LoadUncheckedUserSummaries(_ context.Context, arg keybase1.LoadUncheckedUserSummariesArg) ([]keybase1.UserSummary, error) {
	ctx := &engine.Context{}
	eng := engine.NewUserSummary(arg.Uids, h.G())
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	res := eng.ExportedSummariesList()
	return res, nil
}

func (h *UserHandler) ListTracking(_ context.Context, arg keybase1.ListTrackingArg) (res []keybase1.UserSummary, err error) {
	eng := engine.NewListTrackingEngine(&engine.ListTrackingEngineArg{
		Filter:       arg.Filter,
		ForAssertion: arg.Assertion,
		// Verbose has no effect on this call. At the engine level, it only
		// affects JSON output.
	}, h.G())
	err = engine.RunEngine(eng, &engine.Context{})
	res = eng.TableResult()
	return
}

func (h *UserHandler) ListTrackingJSON(_ context.Context, arg keybase1.ListTrackingJSONArg) (res string, err error) {
	eng := engine.NewListTrackingEngine(&engine.ListTrackingEngineArg{
		JSON:         true,
		Filter:       arg.Filter,
		Verbose:      arg.Verbose,
		ForAssertion: arg.Assertion,
	}, h.G())
	err = engine.RunEngine(eng, &engine.Context{})
	res = eng.JSONResult()
	return
}

func (h *UserHandler) LoadUser(ctx context.Context, arg keybase1.LoadUserArg) (user keybase1.User, err error) {
	loadUserArg := libkb.NewLoadUserByUIDArg(ctx, h.G(), arg.Uid)
	loadUserArg.PublicKeyOptional = true
	u, err := libkb.LoadUser(loadUserArg)
	if err != nil {
		return
	}
	exportedUser := u.Export()
	user = *exportedUser
	return
}

func (h *UserHandler) LoadUserByName(_ context.Context, arg keybase1.LoadUserByNameArg) (user keybase1.User, err error) {
	loadUserArg := libkb.NewLoadUserByNameArg(h.G(), arg.Username)
	loadUserArg.PublicKeyOptional = true
	u, err := libkb.LoadUser(loadUserArg)
	if err != nil {
		return
	}
	exportedUser := u.Export()
	user = *exportedUser
	return
}

func (h *UserHandler) LoadUserPlusKeys(netCtx context.Context, arg keybase1.LoadUserPlusKeysArg) (keybase1.UserPlusKeys, error) {
	netCtx = libkb.WithLogTag(netCtx, "LUPK")
	h.G().Log.CDebugf(netCtx, "+ UserHandler#LoadUserPlusKeys(%+v)", arg)
	ret, err := libkb.LoadUserPlusKeys(netCtx, h.G(), arg.Uid, arg.PollForKID)

	// for debugging purposes, output the returned KIDs (since this can be racy)
	var kids []keybase1.KID
	for _, key := range ret.DeviceKeys {
		if !key.IsSibkey && key.PGPFingerprint == "" {
			kids = append(kids, key.KID)
		}
	}

	h.G().Log.CDebugf(netCtx, "- UserHandler#LoadUserPlusKeys(%+v) -> (UVV=%+v, KIDs=%v, err=%s)", arg, ret.Uvv, kids, libkb.ErrToOk(err))
	return ret, err
}

func (h *UserHandler) Search(_ context.Context, arg keybase1.SearchArg) (results []keybase1.SearchResult, err error) {
	eng := engine.NewSearchEngine(engine.SearchEngineArgs{
		Query: arg.Query,
	}, h.G())
	ctx := &engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	err = engine.RunEngine(eng, ctx)
	if err == nil {
		results = eng.GetResults()
	}
	return
}

func (h *UserHandler) LoadMySettings(ctx context.Context, sessionID int) (us keybase1.UserSettings, err error) {
	emails, err := libkb.LoadUserEmails(h.G())
	if err != nil {
		return
	}
	us.Emails = emails
	return
}

func (h *UserHandler) LoadPublicKeys(ctx context.Context, arg keybase1.LoadPublicKeysArg) (keys []keybase1.PublicKey, err error) {
	larg := libkb.LoadUserArg{UID: arg.Uid, Contextified: libkb.NewContextified(h.G())}
	return h.loadPublicKeys(ctx, larg)
}

func (h *UserHandler) LoadMyPublicKeys(ctx context.Context, sessionID int) (keys []keybase1.PublicKey, err error) {
	larg := libkb.LoadUserArg{Self: true, Contextified: libkb.NewContextified(h.G())}
	return h.loadPublicKeys(ctx, larg)
}

func (h *UserHandler) loadPublicKeys(ctx context.Context, larg libkb.LoadUserArg) (keys []keybase1.PublicKey, err error) {
	u, err := libkb.LoadUser(larg)
	if err != nil {
		return
	}
	var publicKeys []keybase1.PublicKey
	if u.GetComputedKeyFamily() != nil {
		publicKeys = u.GetComputedKeyFamily().Export()
	}
	return publicKeys, nil
}

func (h *UserHandler) LoadAllPublicKeysUnverified(ctx context.Context,
	arg keybase1.LoadAllPublicKeysUnverifiedArg) (keys []keybase1.PublicKey, err error) {

	u, err := libkb.LoadUserFromServer(ctx, h.G(), arg.Uid, nil)
	if err != nil {
		return
	}
	var publicKeys []keybase1.PublicKey
	if u.GetKeyFamily() != nil {
		publicKeys = u.GetKeyFamily().Export()
	}
	return publicKeys, nil
}

func (h *UserHandler) ListTrackers2(_ context.Context, arg keybase1.ListTrackers2Arg) (res keybase1.UserSummary2Set, err error) {
	h.G().Trace(fmt.Sprintf("ListTrackers2(assertion=%s,reverse=%v)", arg.Assertion, arg.Reverse),
		func() error { return err })()
	eng := engine.NewListTrackers2(h.G(), arg)
	ctx := &engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	err = engine.RunEngine(eng, ctx)
	if err == nil {
		res = eng.GetResults()
	}
	return res, err
}

func (h *UserHandler) ResetUser(ctx context.Context, sessionID int) error {
	if h.G().Env.GetRunMode() != libkb.DevelRunMode {
		return errors.New("can only reset user via service RPC in dev mode")
	}
	err := h.G().LoginState().ResetAccount(h.G().Env.GetUsername().String())
	if err != nil {
		return err
	}
	err = h.G().Logout()
	if err != nil {
		return err
	}
	return nil
}

func (h *UserHandler) ProfileEdit(nctx context.Context, arg keybase1.ProfileEditArg) error {
	eng := engine.NewProfileEdit(h.G(), arg)
	ctx := &engine.Context{NetContext: nctx}
	return engine.RunEngine(eng, ctx)
}

func (h *UserHandler) loadUsername(ctx context.Context, uid keybase1.UID) (string, error) {
	arg := libkb.NewLoadUserByUIDArg(ctx, h.G(), uid)
	arg.PublicKeyOptional = true
	arg.StaleOK = true
	arg.CachedOnly = true
	upak, _, err := h.G().GetUPAKLoader().Load(arg)
	if err != nil {
		return "", err
	}
	return upak.GetName(), nil
}

func (h *UserHandler) InterestingPeople(ctx context.Context, maxUsers int) (res []keybase1.InterestingPerson, err error) {

	// Chat source
	chatFn := func(uid keybase1.UID) (kuids []keybase1.UID, err error) {
		g := globals.NewContext(h.G(), h.ChatG())
		list, err := chat.RecentConversationParticipants(ctx, g, uid.ToBytes())
		if err != nil {
			return nil, err
		}
		for _, guid := range list {
			kuids = append(kuids, keybase1.UID(guid.String()))
		}
		return kuids, nil
	}

	// Follower source
	followerFn := func(uid keybase1.UID) (res []keybase1.UID, err error) {
		var found bool
		var tmp keybase1.UserSummary2Set
		found, err = h.G().LocalDb.GetInto(&tmp, libkb.DbKeyUID(libkb.DBTrackers2Reverse, uid))
		if err != nil {
			return nil, err
		}
		if !found {
			return nil, nil
		}
		for _, u := range tmp.Users {
			res = append(res, u.Uid)
		}
		return res, nil
	}

	ip := newInterestingPeople(h.G())

	// Add sources of interesting people
	ip.AddSource(chatFn, 0.9)
	ip.AddSource(followerFn, 0.1)

	uids, err := ip.Get(ctx, maxUsers)
	if err != nil {
		h.G().Log.Debug("InterestingPeople: failed to get list: %s", err.Error())
		return nil, err
	}
	for _, u := range uids {
		name, err := h.loadUsername(ctx, u)
		if err != nil {
			h.G().Log.Debug("InterestingPeople: failed to get username for: %s msg: %s", u, err.Error())
			continue
		}
		res = append(res, keybase1.InterestingPerson{
			Uid:      u,
			Username: name,
		})
	}
	return res, nil
}

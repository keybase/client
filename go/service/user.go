// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

	"github.com/keybase/client/go/avatars"
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
		BaseHandler:      NewBaseHandler(g, xp),
		Contextified:     libkb.NewContextified(g),
		ChatContextified: globals.NewChatContextified(chatG),
	}
}

// ListTrackers gets the list of trackers for a user by uid.
func (h *UserHandler) ListTrackers(ctx context.Context, arg keybase1.ListTrackersArg) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackers(h.G(), arg.Uid)
	return h.listTrackers(ctx, arg.SessionID, eng)
}

// ListTrackersByName gets the list of trackers for a user by
// username.
func (h *UserHandler) ListTrackersByName(ctx context.Context, arg keybase1.ListTrackersByNameArg) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersByName(arg.Username)
	return h.listTrackers(ctx, arg.SessionID, eng)
}

// ListTrackersSelf gets the list of trackers for the logged in
// user.
func (h *UserHandler) ListTrackersSelf(ctx context.Context, sessionID int) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersSelf()
	return h.listTrackers(ctx, sessionID, eng)
}

func (h *UserHandler) listTrackers(ctx context.Context, sessionID int, eng *engine.ListTrackersEngine) ([]keybase1.Tracker, error) {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		SessionID: sessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		return nil, err
	}
	res := eng.ExportedList()
	return res, nil
}

func (h *UserHandler) LoadUncheckedUserSummaries(ctx context.Context, arg keybase1.LoadUncheckedUserSummariesArg) ([]keybase1.UserSummary, error) {
	eng := engine.NewUserSummary(h.G(), arg.Uids)
	m := libkb.NewMetaContext(ctx, h.G())
	if err := engine.RunEngine2(m, eng); err != nil {
		return nil, err
	}
	res := eng.ExportedSummariesList()
	return res, nil
}

func (h *UserHandler) ListTracking(ctx context.Context, arg keybase1.ListTrackingArg) (res []keybase1.UserSummary, err error) {
	eng := engine.NewListTrackingEngine(h.G(), &engine.ListTrackingEngineArg{
		Filter:       arg.Filter,
		ForAssertion: arg.Assertion,
		// Verbose has no effect on this call. At the engine level, it only
		// affects JSON output.
	})
	m := libkb.NewMetaContext(ctx, h.G())
	err = engine.RunEngine2(m, eng)
	res = eng.TableResult()
	return
}

func (h *UserHandler) ListTrackingJSON(ctx context.Context, arg keybase1.ListTrackingJSONArg) (res string, err error) {
	eng := engine.NewListTrackingEngine(h.G(), &engine.ListTrackingEngineArg{
		JSON:         true,
		Filter:       arg.Filter,
		Verbose:      arg.Verbose,
		ForAssertion: arg.Assertion,
	})
	m := libkb.NewMetaContext(ctx, h.G())
	err = engine.RunEngine2(m, eng)
	res = eng.JSONResult()
	return
}

func (h *UserHandler) LoadUser(ctx context.Context, arg keybase1.LoadUserArg) (user keybase1.User, err error) {
	loadUserArg := libkb.NewLoadUserByUIDArg(ctx, h.G(), arg.Uid).WithPublicKeyOptional()
	u, err := libkb.LoadUser(loadUserArg)
	if err != nil {
		return
	}
	exportedUser := u.Export()
	user = *exportedUser
	return
}

func (h *UserHandler) LoadUserByName(_ context.Context, arg keybase1.LoadUserByNameArg) (user keybase1.User, err error) {
	loadUserArg := libkb.NewLoadUserByNameArg(h.G(), arg.Username).WithPublicKeyOptional()
	u, err := libkb.LoadUser(loadUserArg)
	if err != nil {
		return
	}
	exportedUser := u.Export()
	user = *exportedUser
	return
}

func (h *UserHandler) LoadUserPlusKeysV2(netCtx context.Context, arg keybase1.LoadUserPlusKeysV2Arg) (ret keybase1.UserPlusKeysV2AllIncarnations, err error) {
	netCtx = libkb.WithLogTag(netCtx, "LUPK2")
	defer h.G().CTrace(netCtx, fmt.Sprintf("UserHandler#LoadUserPlusKeysV2(%+v)", arg), func() error { return err })()
	p, err := h.G().GetUPAKLoader().LoadV2WithKID(netCtx, arg.Uid, arg.PollForKID)
	if p != nil {
		ret = *p
	}
	return ret, err
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

	if err == nil {
		// ret.Status might indicate an error we should return
		// (like libkb.DeletedError, for example)
		err = libkb.UserErrorFromStatus(ret.Status)
		if err != nil {
			h.G().Log.CDebugf(netCtx, "using error from StatusCode: %v => %s", ret.Status, err)
		}
	}

	h.G().Log.CDebugf(netCtx, "- UserHandler#LoadUserPlusKeys(%+v) -> (UVV=%+v, KIDs=%v, err=%s)", arg, ret.Uvv, kids, libkb.ErrToOk(err))
	return ret, err
}

func (h *UserHandler) Search(ctx context.Context, arg keybase1.SearchArg) (results []keybase1.SearchResult, err error) {
	eng := engine.NewSearchEngine(h.G(), engine.SearchEngineArgs{
		Query: arg.Query,
	})
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	if err == nil {
		results = eng.GetResults()
	}
	return
}

func (h *UserHandler) LoadMySettings(ctx context.Context, sessionID int) (us keybase1.UserSettings, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	emails, err := libkb.LoadUserEmails(m)
	if err != nil {
		return
	}
	us.Emails = emails
	return
}

func (h *UserHandler) LoadPublicKeys(ctx context.Context, arg keybase1.LoadPublicKeysArg) (keys []keybase1.PublicKey, err error) {
	larg := libkb.NewLoadUserArg(h.G()).WithUID(arg.Uid)
	return h.loadPublicKeys(ctx, larg)
}

func (h *UserHandler) LoadMyPublicKeys(ctx context.Context, sessionID int) (keys []keybase1.PublicKey, err error) {
	larg := libkb.NewLoadUserArg(h.G()).WithSelf(true)
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

	u, err := libkb.LoadUserFromServer(libkb.NewMetaContext(ctx, h.G()), arg.Uid, nil)
	if err != nil {
		return
	}
	var publicKeys []keybase1.PublicKey
	if u.GetKeyFamily() != nil {
		publicKeys = u.GetKeyFamily().Export()
	}
	return publicKeys, nil
}

func (h *UserHandler) ListTrackers2(ctx context.Context, arg keybase1.ListTrackers2Arg) (res keybase1.UserSummary2Set, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	defer m.CTrace(fmt.Sprintf("ListTrackers2(assertion=%s,reverse=%v)", arg.Assertion, arg.Reverse),
		func() error { return err })()
	eng := engine.NewListTrackers2(h.G(), arg)
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	m = m.WithUIs(uis)
	err = engine.RunEngine2(m, eng)
	if err == nil {
		res = eng.GetResults()
	}
	return res, err
}

func (h *UserHandler) ProfileEdit(nctx context.Context, arg keybase1.ProfileEditArg) error {
	eng := engine.NewProfileEdit(h.G(), arg)
	m := libkb.NewMetaContext(nctx, h.G())
	return engine.RunEngine2(m, eng)
}

func (h *UserHandler) loadUsername(ctx context.Context, uid keybase1.UID) (string, error) {
	arg := libkb.NewLoadUserByUIDArg(ctx, h.G(), uid).WithPublicKeyOptional().WithStaleOK(true).WithCachedOnly()
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

func (h *UserHandler) MeUserVersion(ctx context.Context, arg keybase1.MeUserVersionArg) (res keybase1.UserVersion, err error) {
	loadMeArg := libkb.NewLoadUserArg(h.G()).
		WithNetContext(ctx).
		WithUID(h.G().Env.GetUID()).
		WithSelf(true).
		WithForcePoll(arg.ForcePoll).
		WithPublicKeyOptional()
	upak, _, err := h.G().GetUPAKLoader().LoadV2(loadMeArg)
	if err != nil {
		return keybase1.UserVersion{}, err
	}
	if upak == nil {
		return keybase1.UserVersion{}, fmt.Errorf("could not load self upak")
	}
	return upak.Current.ToUserVersion(), nil
}

func (h *UserHandler) GetUPAK(ctx context.Context, uid keybase1.UID) (ret keybase1.UPAKVersioned, err error) {
	arg := libkb.NewLoadUserArg(h.G()).WithNetContext(ctx).WithUID(uid).WithPublicKeyOptional()
	upak, _, err := h.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return ret, err
	}
	if upak == nil {
		return ret, libkb.UserNotFoundError{UID: uid, Msg: "upak load failed"}
	}
	ret = keybase1.NewUPAKVersionedWithV2(*upak)
	return ret, err
}

func (h *UserHandler) UploadUserAvatar(ctx context.Context, arg keybase1.UploadUserAvatarArg) (err error) {
	ctx = libkb.WithLogTag(ctx, "US")
	defer h.G().CTraceTimed(ctx, fmt.Sprintf("UploadUserAvatar(%s)", arg.Filename), func() error { return err })()

	mctx := libkb.NewMetaContext(ctx, h.G())
	return avatars.UploadImage(mctx, arg.Filename, nil /* teamname */, arg.Crop)
}

func (h *UserHandler) FindNextMerkleRootAfterRevoke(ctx context.Context, arg keybase1.FindNextMerkleRootAfterRevokeArg) (ret keybase1.NextMerkleRootRes, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	m = m.WithLogTag("FNMR")
	defer m.CTraceTimed("UserHandler#FindNextMerkleRootAfterRevoke", func() error { return err })()
	return libkb.FindNextMerkleRootAfterRevoke(m, arg)
}

func (h *UserHandler) FindNextMerkleRootAfterReset(ctx context.Context, arg keybase1.FindNextMerkleRootAfterResetArg) (ret keybase1.NextMerkleRootRes, err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	m = m.WithLogTag("FNMR")
	defer m.CTraceTimed("UserHandler#FindNextMerkleRootAfterReset", func() error { return err })()
	return libkb.FindNextMerkleRootAfterReset(m, arg)
}

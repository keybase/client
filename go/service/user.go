// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// UserHandler is the RPC handler for the user interface.
type UserHandler struct {
	*BaseHandler
	libkb.Contextified
}

// NewUserHandler creates a UserHandler for the xp transport.
func NewUserHandler(xp rpc.Transporter, g *libkb.GlobalContext) *UserHandler {
	return &UserHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
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

func (h *UserHandler) LoadUser(_ context.Context, arg keybase1.LoadUserArg) (user keybase1.User, err error) {
	u, err := libkb.LoadUser(libkb.NewLoadUserByUIDArg(h.G(), arg.Uid))
	if err != nil {
		return
	}
	exportedUser := u.Export()
	user = *exportedUser
	return
}

func (h *UserHandler) LoadUserByName(_ context.Context, arg keybase1.LoadUserByNameArg) (user keybase1.User, err error) {
	u, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(h.G(), arg.Username))
	if err != nil {
		return
	}
	exportedUser := u.Export()
	user = *exportedUser
	return
}

func (h *UserHandler) LoadUserPlusKeys(_ context.Context, arg keybase1.LoadUserPlusKeysArg) (keybase1.UserPlusKeys, error) {
	return libkb.LoadUserPlusKeys(h.G(), arg.Uid)
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

func (h *UserHandler) LoadPublicKeys(_ context.Context, arg keybase1.LoadPublicKeysArg) (keys []keybase1.PublicKey, err error) {
	u, err := libkb.LoadUser(libkb.LoadUserArg{UID: arg.Uid, Contextified: libkb.NewContextified(h.G())})
	if err != nil {
		return
	}
	var publicKeys []keybase1.PublicKey
	if u.GetComputedKeyFamily() != nil {
		publicKeys = u.GetComputedKeyFamily().Export()
	}
	return publicKeys, nil
}

func (h *UserHandler) LoadAllPublicKeysUnverified(_ context.Context,
	arg keybase1.LoadAllPublicKeysUnverifiedArg) (keys []keybase1.PublicKey, err error) {

	u, err := libkb.LoadUserFromServer(h.G(), arg.Uid, nil)
	if err != nil {
		return
	}
	var publicKeys []keybase1.PublicKey
	if u.GetKeyFamily() != nil {
		publicKeys = u.GetKeyFamily().Export()
	}
	return publicKeys, nil
}

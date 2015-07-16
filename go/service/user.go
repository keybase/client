package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// UserHandler is the RPC handler for the user interface.
type UserHandler struct {
	*BaseHandler
}

// NewUserHandler creates a UserHandler for the xp transport.
func NewUserHandler(xp *rpc2.Transport) *UserHandler {
	return &UserHandler{BaseHandler: NewBaseHandler(xp)}
}

// ListTrackers gets the list of trackers for a user by uid.
func (h *UserHandler) ListTrackers(arg keybase1.ListTrackersArg) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackers(arg.Uid, G)
	return h.listTrackers(arg.SessionID, eng)
}

// ListTrackersByName gets the list of trackers for a user by
// username.
func (h *UserHandler) ListTrackersByName(arg keybase1.ListTrackersByNameArg) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersByName(arg.Username)
	return h.listTrackers(arg.SessionID, eng)
}

// ListTrackersSelf gets the list of trackers for the logged in
// user.
func (h *UserHandler) ListTrackersSelf(sessionID int) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersSelf()
	return h.listTrackers(sessionID, eng)
}

func (h *UserHandler) listTrackers(sessionID int, eng *engine.ListTrackersEngine) ([]keybase1.Tracker, error) {
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID)}
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	res := eng.ExportedList()
	return res, nil
}

func (h *UserHandler) LoadUncheckedUserSummaries(arg keybase1.LoadUncheckedUserSummariesArg) ([]keybase1.UserSummary, error) {
	ctx := &engine.Context{}
	eng := engine.NewUserSummary(arg.Uids, G)
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	res := eng.ExportedSummariesList()
	return res, nil
}

func (h *UserHandler) ListTracking(arg keybase1.ListTrackingArg) (res []keybase1.UserSummary, err error) {
	eng := engine.NewListTrackingEngine(&engine.ListTrackingEngineArg{
		Filter: arg.Filter,
		// Verbose has no effect on this call. At the engine level, it only
		// affects JSON output.
	}, G)
	err = engine.RunEngine(eng, &engine.Context{})
	res = eng.TableResult()
	return
}

func (h *UserHandler) ListTrackingJSON(arg keybase1.ListTrackingJSONArg) (res string, err error) {
	eng := engine.NewListTrackingEngine(&engine.ListTrackingEngineArg{
		JSON:    true,
		Filter:  arg.Filter,
		Verbose: arg.Verbose,
	}, G)
	err = engine.RunEngine(eng, &engine.Context{})
	res = eng.JSONResult()
	return
}

func (h *UserHandler) LoadUser(arg keybase1.LoadUserArg) (user keybase1.User, err error) {
	var uid keybase1.UID
	if arg.Uid != nil {
		uid = *arg.Uid
	}
	userObj, err := libkb.LoadUser(libkb.LoadUserArg{
		UID:  uid,
		Name: arg.Username,
		Self: arg.IsSelf,
	})
	if err != nil {
		return
	}
	exportedUser := userObj.Export()
	user = *exportedUser
	return
}

func (h *UserHandler) Search(arg keybase1.SearchArg) (results []keybase1.UserSummary, err error) {
	eng := engine.NewSearchEngine(engine.SearchEngineArgs{
		Query: arg.Query,
	}, G)
	ctx := &engine.Context{LogUI: h.getLogUI(arg.SessionID)}
	err = engine.RunEngine(eng, ctx)
	if err == nil {
		results = eng.GetResults()
	}
	return
}

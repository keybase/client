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
	uid := libkb.ImportUID(arg.Uid)
	eng := engine.NewListTrackers(&uid)
	return h.listTrackers(eng)
}

// ListTrackersByName gets the list of trackers for a user by
// username.
func (h *UserHandler) ListTrackersByName(arg keybase1.ListTrackersByNameArg) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersByName(arg.Username)
	return h.listTrackers(eng)
}

// ListTrackersSelf gets the list of trackers for the logged in
// user.
func (h *UserHandler) ListTrackersSelf(sessionID int) ([]keybase1.Tracker, error) {
	eng := engine.NewListTrackersSelf()
	return h.listTrackers(eng)
}

func (h *UserHandler) listTrackers(eng *engine.ListTrackersEngine) ([]keybase1.Tracker, error) {
	sessionID := nextSessionID()
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID)}
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	res := eng.ExportedList()
	return res, nil
}

func (h *UserHandler) LoadUncheckedUserSummaries(kuids []keybase1.UID) ([]keybase1.UserSummary, error) {
	uids := make([]libkb.UID, len(kuids))
	for i, k := range kuids {
		uids[i] = libkb.ImportUID(k)
	}
	ctx := &engine.Context{}
	eng := engine.NewUserSummary(uids)
	if err := engine.RunEngine(eng, ctx); err != nil {
		return nil, err
	}
	res := eng.ExportedSummariesList()
	return res, nil
}

func (h *UserHandler) ListTracking(filter string) (res []keybase1.UserSummary, err error) {
	eng := engine.NewListTrackingEngine(&engine.ListTrackingEngineArg{
		Filter: filter,
		// Verbose has no effect on this call. At the engine level, it only
		// affects JSON output.
	})
	err = engine.RunEngine(eng, &engine.Context{})
	res = eng.TableResult()
	return
}

func (h *UserHandler) ListTrackingJson(arg keybase1.ListTrackingJsonArg) (res string, err error) {
	eng := engine.NewListTrackingEngine(&engine.ListTrackingEngineArg{
		Json:    true,
		Filter:  arg.Filter,
		Verbose: arg.Verbose,
	})
	err = engine.RunEngine(eng, &engine.Context{})
	res = eng.JSONResult()
	return
}

func (h *UserHandler) LoadUser(arg keybase1.LoadUserArg) (user keybase1.User, err error) {
	var uid *libkb.UID
	if arg.Uid != nil {
		uidVal := libkb.ImportUID(*arg.Uid)
		uid = &uidVal
	}
	userObj, err := libkb.LoadUser(libkb.LoadUserArg{
		Uid:  uid,
		Name: arg.Username,
		Self: arg.Self,
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
	})
	ctx := &engine.Context{LogUI: h.getLogUI(arg.SessionID)}
	err = engine.RunEngine(eng, ctx)
	if err == nil {
		results = eng.GetResults()
	}
	return
}

package main

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

// UserHandler is the RPC handler for the user interface.
type UserHandler struct {
	BaseHandler
}

// NewUserHandler creates a UserHandler for the xp transport.
func NewUserHandler(xp *rpc2.Transport) *UserHandler {
	return &UserHandler{BaseHandler{xp: xp}}
}

// ListTrackers gets the list of trackers for a user by uid.
func (h *UserHandler) ListTrackers(arg keybase_1.ListTrackersArg) ([]keybase_1.Tracker, error) {
	uid := libkb.ImportUID(arg.Uid)
	eng := engine.NewListTrackers(&uid)
	return h.listTrackers(eng)
}

// TrackerListByName gets the list of trackers for a user by
// username.
func (h *UserHandler) ListTrackersByName(arg keybase_1.ListTrackersByNameArg) ([]keybase_1.Tracker, error) {
	eng := engine.NewListTrackersByName(arg.Username)
	return h.listTrackers(eng)
}

func (h *UserHandler) listTrackers(eng *engine.ListTrackersEngine) ([]keybase_1.Tracker, error) {
	sessionID := nextSessionId()
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID)}
	if err := engine.RunEngine(eng, ctx, nil, nil); err != nil {
		return nil, err
	}
	res := eng.ExportedList()
	return res, nil
}

func (h *UserHandler) LoadUncheckedUserSummaries(kuids []keybase_1.UID) ([]keybase_1.UserSummary, error) {
	uids := make([]libkb.UID, len(kuids))
	for i, k := range kuids {
		uids[i] = libkb.ImportUID(k)
	}
	ctx := &engine.Context{}
	eng := engine.NewUserSummary(uids)
	if err := engine.RunEngine(eng, ctx, nil, nil); err != nil {
		return nil, err
	}
	res := eng.ExportedSummariesList()
	return res, nil
}

func (h *UserHandler) ListTracking(filter string) (res []keybase_1.TrackEntry, err error) {
	eng := engine.NewListTrackingEngine(&engine.ListTrackingEngineArg{
		Filter: filter,
		// Verbose has no effect on this call. At the engine level, it only
		// affects JSON output.
	})
	err = engine.RunEngine(eng, &engine.Context{}, nil, nil)
	res = eng.TableResult()
	return
}

func (h *UserHandler) ListTrackingJson(arg keybase_1.ListTrackingJsonArg) (res string, err error) {
	eng := engine.NewListTrackingEngine(&engine.ListTrackingEngineArg{
		Json:    true,
		Filter:  arg.Filter,
		Verbose: arg.Verbose,
	})
	err = engine.RunEngine(eng, &engine.Context{}, nil, nil)
	res = eng.JsonResult()
	return
}

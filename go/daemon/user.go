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

// TrackerList gets the list of trackers for a user.
func (h *UserHandler) TrackerList(arg keybase_1.TrackerListArg) ([]keybase_1.Tracker, error) {
	sessionID := nextSessionId()
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID)}
	uid := libkb.ImportUID(arg.Uid)
	eng := engine.NewTrackerList(&uid)
	if err := engine.RunEngine(eng, ctx, nil, nil); err != nil {
		return nil, err
	}
	tr := eng.List()
	res := make([]keybase_1.Tracker, len(tr))
	for i, t := range tr {
		res[i] = keybase_1.Tracker{
			Tracker: t.Tracker.Export(),
			Status:  t.Status,
			Mtime:   t.Mtime,
		}
	}
	return res, nil
}

func (h *UserHandler) TrackerListByName(arg keybase_1.TrackerListByNameArg) ([]keybase_1.Tracker, error) {
	sessionID := nextSessionId()
	ctx := &engine.Context{LogUI: h.getLogUI(sessionID)}
	eng := engine.NewTrackerListUsername(arg.Username)
	if err := engine.RunEngine(eng, ctx, nil, nil); err != nil {
		return nil, err
	}
	tr := eng.List()
	res := make([]keybase_1.Tracker, len(tr))
	for i, t := range tr {
		res[i] = keybase_1.Tracker{
			Tracker: t.Tracker.Export(),
			Status:  t.Status,
			Mtime:   t.Mtime,
		}
	}
	return res, nil
}

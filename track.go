
package main

import (
	"github.com/keybase/protocol/go"
	"github.com/keybase/go-libkb"
	"net"
	"sync"
)

type TrackHandler struct {
	conn net.Conn
	mutex *sync.Mutex
	sessions map[int](*RemoteTrackUI)
	sessionId int
}

func NewTrackHandler() *TrackHandler {
	return &TrackHandler{
		mutex : new(sync.Mutex),
		sessions : make(map[int](*RemoteTrackUI)),
		sessionId : 0,
	}
}

func (h *TrackHandler) IdentifySelfStart(arg *keybase_1.IdentifySelfStartArg, res *keybase_1.IdentifyStartRes) error {
	// We might need to ID ourselves, to load us in here
	u, err := libkb.LoadMe(libkb.LoadUserArg{})
	if _, not_found := err.(libkb.NoKeyError); not_found {
		err = nil
	} else if _, not_selected := err.(libkb.NoSelectedKeyError); not_selected {
		h.identifySelf(u, res)
	} else {
		res.Status = libkb.ExportErrorAsStatus(err)
	}
	return nil
}

func (h *TrackHandler) getNextSessionId() int {
	sessionId := h.sessionId
	h.sessionId++
	return sessionId
}

func (h *TrackHandler) getNewUI(u *libkb.User) (*RemoteTrackUI, int) {
	ui := &RemoteTrackUI{u}
	sid := h.getNextSessionId()
	h.sessions[sid] = ui
	return ui, sid
}

func (h *TrackHandler) identifySelf(u *libkb.User, res *keybase_1.IdentifyStartRes) {
	ui, sid := h.getNewUI(u)
	_, err := u.IdentifySelf(ui)
	res.Status = libkb.ExportErrorAsStatus(err)
	if err == nil {
		var body keybase_1.IdentifyStartResBody
		res.Body = &body
		body.SessionId = sid
	}
	return
}


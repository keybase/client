
package main

import (
	"github.com/keybase/protocol/go"
	"github.com/keybase/go-libkb"
	"net"
	"sync"
	"time"
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
	ui := NewRemoteTrackUI(u)
	h.mutex.Lock()
	sid := h.getNextSessionId()
	h.sessions[sid] = ui
	h.mutex.Unlock()
	return ui, sid
}

func (h *TrackHandler) killSession(i int) {
	h.mutex.Lock()
	delete(h.sessions, i)
	h.mutex.Unlock()
}

func (h *TrackHandler) lookupSession(i int) *RemoteTrackUI {
	h.mutex.Lock()
	ret := h.sessions[i]
	h.mutex.Unlock()
	return ret
}

func (h *TrackHandler) IdentifyCheck(arg *keybase_1.IdentifyCheckArg, res *keybase_1.IdentifyCheckRes) error {
	sess := h.lookupSession(arg.SessionId)
	var err error 
	if sess == nil {
		err = BadTrackSessionError{arg.SessionId}
	} else {
		p := <- sess.checks[arg.RowId]
		res.Body = &p
	}
	res.Status = libkb.ExportErrorAsStatus(err)
	return nil	
}

func (h *TrackHandler) identifySelf(u *libkb.User, res *keybase_1.IdentifyStartRes) {
	h.identify(nil, u, true, res)
	return
}

func (h *TrackHandler) identify(them, me *libkb.User, self bool, res *keybase_1.IdentifyStartRes) {
	ui, sid := h.getNewUI(them)
	go func(){
		var err error
		if self {
			_, err = me.IdentifySelf(ui)
		} else {
			_, err = them.Identify(libkb.IdentifyArg{ Ui : ui, Me : me })
		}
		ui.ch <- IdentifyStartResOrError { err : err }
	}()
	go func(){
		time.Sleep(libkb.TRACK_SESSION_TIMEOUT)
		h.killSession(sid)
	}()

	// Wait until either identify self flops, or it's gotten as far as
	// the first network wait point.
	ioe := <-ui.ch

	err := ioe.err
	if err == nil && ioe.err != nil {
		err = ioe.err
	}
	res.Status = libkb.ExportErrorAsStatus(err)
	if err == nil {
		res.Body = ioe.body
		res.Body.SessionId = sid
	}

	h.killSession(sid)

	return
}


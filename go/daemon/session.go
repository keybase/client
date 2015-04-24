package main

import (
	"errors"

	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

var ErrNoSession = errors.New("no current session")

// SessionHandler is the RPC handler for the session interface.
type SessionHandler struct {
	BaseHandler
}

// NewSessionHandler creates a SessionHandler for the xp transport.
func NewSessionHandler(xp *rpc2.Transport) *SessionHandler {
	return &SessionHandler{BaseHandler{xp: xp}}
}

// CurrentSession uses the global session to find the session.  If
// the user isn't logged in, it returns ErrNoSession.
func (h *SessionHandler) CurrentSession() (keybase_1.Session, error) {
	var s keybase_1.Session
	if !G.LoginState().IsLoggedIn() {
		return s, ErrNoSession
	}

	uid, username, token := G.LoginState().UserInfo()
	s.Uid = uid.Export()
	s.Username = username
	s.Token = token

	return s, nil
}

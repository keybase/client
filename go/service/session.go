package service

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

var ErrNoSession = errors.New("no current session")

// SessionHandler is the RPC handler for the session interface.
type SessionHandler struct {
	*BaseHandler
}

// NewSessionHandler creates a SessionHandler for the xp transport.
func NewSessionHandler(xp *rpc2.Transport) *SessionHandler {
	return &SessionHandler{BaseHandler: NewBaseHandler(xp)}
}

// CurrentSession uses the global session to find the session.  If
// the user isn't logged in, it returns ErrNoSession.
func (h *SessionHandler) CurrentSession() (keybase1.Session, error) {
	var s keybase1.Session
	var username, token string
	var uid keybase1.UID
	var deviceSubkey libkb.GenericKey
	var err error

	G.LoginState().Account(func(a *libkb.Account) {
		uid, username, token, deviceSubkey, err = a.UserInfo()
	}, "Service - SessionHandler - UserInfo")
	if err != nil {
		if _, ok := err.(libkb.LoginRequiredError); ok {
			return s, ErrNoSession
		}
		return s, err
	}

	s.Uid = uid
	s.Username = username
	s.Token = token
	s.DeviceSubkeyKid = deviceSubkey.GetKid().String()

	return s, nil
}

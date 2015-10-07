package service

import (
	"errors"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

var ErrNoSession = errors.New("no current session")

// SessionHandler is the RPC handler for the session interface.
type SessionHandler struct {
	*BaseHandler
}

// NewSessionHandler creates a SessionHandler for the xp transport.
func NewSessionHandler(xp rpc.Transporter) *SessionHandler {
	return &SessionHandler{BaseHandler: NewBaseHandler(xp)}
}

// CurrentSession uses the global session to find the session.  If
// the user isn't logged in, it returns ErrNoSession.
func (h *SessionHandler) CurrentSession(sessionID int) (keybase1.Session, error) {
	var s keybase1.Session
	var token string
	var username libkb.NormalizedUsername
	var uid keybase1.UID
	var deviceSubkey libkb.GenericKey
	var err error

	aerr := G.LoginState().Account(func(a *libkb.Account) {
		uid, username, token, deviceSubkey, err = a.UserInfo()
	}, "Service - SessionHandler - UserInfo")
	if aerr != nil {
		return s, aerr
	}
	if err != nil {
		if _, ok := err.(libkb.LoginRequiredError); ok {
			return s, ErrNoSession
		}
		return s, err
	}

	s.Uid = uid
	s.Username = username.String()
	s.Token = token
	s.DeviceSubkeyKid = deviceSubkey.GetKID()

	return s, nil
}

// CurrentUID returns the logged in user's UID, or ErrNoSession if
// not logged in.
func (h *SessionHandler) CurrentUID(sessionID int) (keybase1.UID, error) {
	uid, err := engine.CurrentUID(G)
	if err != nil {
		if _, ok := err.(libkb.LoginRequiredError); ok {
			return uid, ErrNoSession
		}
		return uid, err
	}
	return uid, nil
}

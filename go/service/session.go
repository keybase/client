package service

import (
	"errors"

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
	// TODO: Bah, this is so racy. Fix this.
	var s keybase1.Session
	if !G.LoginState().IsLoggedIn() {
		return s, ErrNoSession
	}

	uid, username, token, deviceSubkeyKid, err := G.LoginState().UserInfo()
	if err != nil {
		return s, err
	}

	s.Uid = uid.Export()
	s.Username = username
	s.Token = token
	s.DeviceSubkeyKid = deviceSubkeyKid.String()

	return s, nil
}

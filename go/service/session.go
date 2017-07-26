// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// SessionHandler is the RPC handler for the session interface.
type SessionHandler struct {
	libkb.Contextified
	*BaseHandler
}

// NewSessionHandler creates a SessionHandler for the xp transport.
func NewSessionHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SessionHandler {
	return &SessionHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

// CurrentSession uses the global session to find the session.  If
// the user isn't logged in, it returns libkb.NoSessionError.
//
// This function was modified to use cached information instead
// of loading the full self user.
//
// This does do a full call to sesscheck and ensures that the
// session token is valid.
func (h *SessionHandler) CurrentSession(_ context.Context, sessionID int) (keybase1.Session, error) {
	var s keybase1.Session

	status, err := h.G().LoginState().APIServerSession(true /* force session check with server */)
	if err != nil {
		if _, ok := err.(libkb.LoginRequiredError); ok {
			return s, libkb.NoSessionError{}
		}
		if os.IsNotExist(err) {
			return s, libkb.NoSessionError{}
		}
		if _, ok := err.(libkb.NotFoundError); ok {
			return s, libkb.NoSessionError{}
		}
		return s, err
	}

	sibkey, err := h.G().ActiveDevice.SigningKey()
	if err != nil {
		return s, err
	}
	subkey, err := h.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return s, err
	}

	s.Uid = status.UID
	s.Username = status.Username.String()
	s.Token = status.SessionToken
	s.DeviceSubkeyKid = subkey.GetKID()
	s.DeviceSibkeyKid = sibkey.GetKID()

	return s, nil
}

// SessionPing can be used by keepalives for connected services.
func (h *SessionHandler) SessionPing(context.Context) error {
	return nil
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
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
// the user isn't logged in, it returns ErrNoSession.
func (h *SessionHandler) CurrentSession(_ context.Context, sessionID int) (keybase1.Session, error) {
	var s keybase1.Session
	var token string
	var username libkb.NormalizedUsername
	var uid keybase1.UID
	var deviceSubkey, deviceSibkey libkb.GenericKey
	var err error

	aerr := h.G().LoginState().Account(func(a *libkb.Account) {
		_, err = a.LoggedInProvisionedCheck()
		if err != nil {
			return
		}
		uid, username, token, deviceSubkey, deviceSibkey, err = a.UserInfo()
	}, "Service - SessionHandler - UserInfo")
	if aerr != nil {
		return s, aerr
	}
	if err != nil {
		if _, ok := err.(libkb.LoginRequiredError); ok {
			return s, libkb.NoSessionError{}
		}
		return s, err
	}

	s.Uid = uid
	s.Username = username.String()
	s.Token = token
	s.DeviceSubkeyKid = deviceSubkey.GetKID()
	s.DeviceSibkeyKid = deviceSibkey.GetKID()

	return s, nil
}

// SessionPing can be used by keepalives for connected services.
func (h *SessionHandler) SessionPing(context.Context) error {
	return nil
}

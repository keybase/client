// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

var ErrNoSession = errors.New("no current session")

// SessionHandler implements the keybase1.SessionInterface
type SessionHandler struct {
	libkb.Contextified
}

// SessionRPCHandler is the RPC handler for the keybase1.SessionInterface
type SessionRPCHandler struct {
	*BaseHandler
	*SessionHandler
}

// NewSessionHandler constructs a SessionHandler
func NewSessionHandler(g *libkb.GlobalContext) *SessionHandler {
	return &SessionHandler{
		Contextified: libkb.NewContextified(g),
	}
}

// NewSessionRPCHandler creates a SessionHandler for the xp transport.
func NewSessionRPCHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SessionRPCHandler {
	return &SessionRPCHandler{
		BaseHandler:    NewBaseHandler(xp),
		SessionHandler: NewSessionHandler(g),
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
		_, err = a.LoggedInProvisionedLoad()
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
			return s, ErrNoSession
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

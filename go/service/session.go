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
// the user isn't logged in, it returns libkb.NoSessionError.
//
// This function was modified to use cached information instead
// of loading the full self user and possibliy running sesscheck.
// The only potential problem with that is that the session token
// could be stale.  However, KBFS reports that they don't use
// the session token, so not an issue currently.
func (h *SessionHandler) CurrentSession(_ context.Context, sessionID int) (keybase1.Session, error) {
	var s keybase1.Session
	var uid keybase1.UID
	var username libkb.NormalizedUsername
	var token string
	var sibkey, subkey libkb.GenericKey
	var err error
	aerr := h.G().LoginState().Account(func(a *libkb.Account) {
		_, err = a.LoggedInProvisioned()
		if err != nil {
			return
		}
		uid = a.G().ActiveDevice.UID()
		username = a.G().Env.GetUsername()
		token = a.LocalSession().GetToken()
		sibkey, err = a.G().ActiveDevice.SigningKey()
		if err != nil {
			return
		}
		subkey, err = a.G().ActiveDevice.EncryptionKey()
		if err != nil {
			return
		}
	}, "Service - SessionHandler - CurrentSession")
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
	s.DeviceSubkeyKid = subkey.GetKID()
	s.DeviceSibkeyKid = sibkey.GetKID()
	return s, nil
}

// SessionPing can be used by keepalives for connected services.
func (h *SessionHandler) SessionPing(context.Context) error {
	return nil
}

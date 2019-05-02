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
		BaseHandler:  NewBaseHandler(g, xp),
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
func (h *SessionHandler) CurrentSession(ctx context.Context, sessionID int) (keybase1.Session, error) {
	var s keybase1.Session

	nist, uid, _, err := h.G().ActiveDevice.NISTAndUIDDeviceID(ctx)
	if nist == nil {
		return s, libkb.NoSessionError{}
	}
	if err != nil {
		return s, err
	}

	un, err := h.G().GetUPAKLoader().LookupUsername(ctx, uid)
	if err != nil {
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

	s.Uid = uid
	s.Username = un.String()
	s.Token = nist.Token().String()
	s.DeviceSubkeyKid = subkey.GetKID()
	s.DeviceSibkeyKid = sibkey.GetKID()

	return s, nil
}

// SessionPing can be used by keepalives for connected services.
func (h *SessionHandler) SessionPing(context.Context) error {
	return nil
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
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
// the user isn't logged in, it returns engine.ErrNoSession.
func (h *SessionHandler) CurrentSession(_ context.Context, sessionID int) (keybase1.Session, error) {
	return engine.CurrentSession(h.G(), sessionID)
}

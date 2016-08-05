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
// the user isn't logged in, it returns engine.ErrNoSession.
func (h *SessionHandler) CurrentSession(_ context.Context, sessionID int) (keybase1.Session, error) {
	return engine.CurrentSession(h.G(), sessionID)
}

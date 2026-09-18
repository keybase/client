// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// NotifyCtlHandler is the RPC handler for notify control messages
type NotifyCtlHandler struct {
	libkb.Contextified
	*BaseHandler
	id  libkb.ConnectionID
	svc *Service
}

// NewNotifyCtlHandler creates a new handler for setting up notification
// channels
func NewNotifyCtlHandler(xp rpc.Transporter, id libkb.ConnectionID, g *libkb.GlobalContext, svc *Service) *NotifyCtlHandler {
	return &NotifyCtlHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(g, xp),
		id:           id,
		svc:          svc,
	}
}

// SetNotifications registers the channels and then reads the client state. The
// order is not a convention here: the version that labels the reply is what
// SetChannels returns, so the state below cannot be read before the connection is
// subscribed. A change from here on is announced to this connection, so the reply
// can only miss something the client is about to be told about anyway.
func (h *NotifyCtlHandler) SetNotifications(ctx context.Context, n keybase1.NotificationChannels) (keybase1.ClientState, error) {
	// The version is read before the state it describes. NextStateVersion is
	// stamped after a change is readable, so this snapshot is never newer than its
	// label and a client can drop it on a tie without losing anything.
	version := h.G().NotifyRouter.SetChannels(h.id, n)
	res := keybase1.ClientState{Version: version, AppState: h.G().MobileAppState.State()}
	// The session is left out until the startup login attempt has settled: before
	// that there is no session to describe, and reporting a logged-out one would
	// be a lie the client would have to be corrected out of by a notification it
	// might never get. The client falls back to getBootstrapStatus, which waits.
	if h.svc.initialLoginAttemptSettled() {
		session, _ := engine.SessionState(libkb.NewMetaContext(ctx, h.G()))
		res.Session = &session
	}
	if info, err := h.svc.httpSrv.Info(); err == nil {
		res.HttpSrvInfo = &info
	}
	return res, nil
}

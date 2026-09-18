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

// SetNotifications registers the channels and then reads the client state, in
// that order: a change from here on is announced to this connection, so the
// reply can only miss something the client is about to be told about anyway.
// That is what removes the ordering problem between a subscription and a
// separate read of the same state.
func (h *NotifyCtlHandler) SetNotifications(ctx context.Context, n keybase1.NotificationChannels) (keybase1.ClientState, error) {
	h.G().NotifyRouter.SetChannels(h.id, n)
	// Read the version before the state it describes. NextStateVersion is stamped
	// after a change is readable, so this snapshot is never newer than its label
	// and a client can drop it on a tie without losing anything.
	version := h.G().StateVersion()
	res, _ := engine.SessionState(libkb.NewMetaContext(ctx, h.G()))
	res.Version = version
	if info, err := h.svc.httpSrv.Info(); err == nil {
		res.HttpSrvInfo = &info
	}
	return res, nil
}

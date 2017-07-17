// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

// NotifyCtlHandler is the RPC handler for notify control messages
type NotifyCtlHandler struct {
	libkb.Contextified
	*BaseHandler
	id libkb.ConnectionID
}

// NewNotifyCtlHandler creates a new handler for setting up notification
// channels
func NewNotifyCtlHandler(xp rpc.Transporter, id libkb.ConnectionID, g *libkb.GlobalContext) *NotifyCtlHandler {
	return &NotifyCtlHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(xp),
		id:           id,
	}
}

func (h *NotifyCtlHandler) SetNotifications(_ context.Context, n keybase1.NotificationChannels) error {
	h.G().NotifyRouter.SetChannels(h.id, n)
	return nil
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	// "fmt"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
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

func (h *NotifyCtlHandler) SetNotifications(UNDER context.Context, n keybase1.NotificationChannels) error {
	/*
		TEMP mcuase this crashes
		fmt.Println("BBBB SetNofications", n, h, h.G, h.id, UNDER)
		fmt.Println("BBBB SetNofications", h.G(), h.G().NotifyRouter, h.G().NotifyRouter.SetChannels)
		h.G().NotifyRouter.SetChannels(h.id, n)
	*/
	return nil
}

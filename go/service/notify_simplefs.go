// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type NotifySimpleFSHandler struct {
	*BaseHandler
	libkb.Contextified
	globals.ChatContextified
	service *Service
}

func NewNotifySimpleFSHandler(xp rpc.Transporter, g *libkb.GlobalContext, cg *globals.ChatContext, service *Service) *NotifySimpleFSHandler {
	return &NotifySimpleFSHandler{
		BaseHandler:      NewBaseHandler(g, xp),
		Contextified:     libkb.NewContextified(g),
		ChatContextified: globals.NewChatContextified(cg),
		service:          service,
	}
}

func (h *NotifySimpleFSHandler) SimpleFSArchiveStatusChanged(ctx context.Context, status keybase1.SimpleFSArchiveStatus) error {
	h.G().NotifyRouter.HandleSimpleFSArchiveStatusChanged(ctx, status)
	return nil
}

// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for home operations

package service

import (
	"github.com/keybase/client/go/home"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type HomeHandler struct {
	*BaseHandler
	home *home.Home
}

func NewHomeHandler(xp rpc.Transporter, g *libkb.GlobalContext, home *home.Home) *HomeHandler {
	handler := &HomeHandler{
		BaseHandler: NewBaseHandler(g, xp),
		home:        home,
	}
	return handler
}

var _ keybase1.HomeInterface = (*HomeHandler)(nil)

func (h *HomeHandler) HomeGetScreen(ctx context.Context, arg keybase1.HomeGetScreenArg) (keybase1.HomeScreen, error) {
	return h.home.Get(ctx, arg.MarkViewed, arg.NumFollowSuggestionsWanted)
}

func (h *HomeHandler) HomeSkipTodoType(ctx context.Context, typ keybase1.HomeScreenTodoType) error {
	return h.home.SkipTodoType(ctx, typ)
}

func (h *HomeHandler) HomeDismissAnnouncement(ctx context.Context, id keybase1.HomeScreenAnnouncementID) error {
	return h.home.DismissAnnouncement(ctx, id)
}

func (h *HomeHandler) HomeActionTaken(ctx context.Context) error {
	return h.home.ActionTaken(ctx)
}

func (h *HomeHandler) HomeMarkViewed(ctx context.Context) error {
	return h.home.MarkViewed(ctx)
}

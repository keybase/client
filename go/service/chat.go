// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/gregor/protocol/chat1"
)

type chatLocalHandler struct {
	*BaseHandler
	libkb.Contextified
}

func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext) *chatLocalHandler {
	return &chatLocalHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *chatLocalHandler) GetInboxLocal(context.Context, *chat1.Pagination) (chat1.InboxView, error) {
	return chat1.InboxView{}, nil
}

func (h *chatLocalHandler) GetThreadLocal(context.Context, keybase1.GetThreadLocalArg) (keybase1.ThreadView, error) {
	return keybase1.ThreadView{}, nil
}

func (h *chatLocalHandler) NewConversationLocal(context.Context, chat1.ConversationIDTriple) error {
	return nil
}

func (h *chatLocalHandler) PostLocal(context.Context, keybase1.PostLocalArg) error {
	return nil
}

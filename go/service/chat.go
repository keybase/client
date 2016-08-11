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
	gh *gregorHandler
}

func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext, gh *gregorHandler) *chatLocalHandler {
	return &chatLocalHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		gh:           gh,
	}
}

func (h *chatLocalHandler) GetInboxLocal(ctx context.Context, p *chat1.Pagination) (chat1.InboxView, error) {
	return h.remoteClient().GetInboxRemote(ctx, p)
}

func (h *chatLocalHandler) GetThreadLocal(ctx context.Context, arg keybase1.GetThreadLocalArg) (keybase1.ThreadView, error) {
	rarg := chat1.GetThreadRemoteArg{
		ConversationID: arg.ConversationID,
		Pagination:     arg.Pagination,
	}
	boxed, err := h.remoteClient().GetThreadRemote(ctx, rarg)
	if err != nil {
		return keybase1.ThreadView{}, err
	}

	// TODO: ThreadViewBoxed -> ThreadView
	_ = boxed

	return keybase1.ThreadView{}, nil
}

func (h *chatLocalHandler) NewConversationLocal(context.Context, chat1.ConversationIDTriple) error {
	return nil
}

func (h *chatLocalHandler) PostLocal(ctx context.Context, arg keybase1.PostLocalArg) error {
	rarg := chat1.PostRemoteArg{
		ConversationID: arg.ConversationID,
	}

	// TODO: arg.MessagePlaintext => rarg.MessageBoxed

	return h.remoteClient().PostRemote(ctx, rarg)
}

func (h *chatLocalHandler) remoteClient() *chat1.RemoteClient {
	return &chat1.RemoteClient{Cli: h.gh.cli}
}

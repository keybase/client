// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"github.com/keybase/gregor/protocol/chat1"
)

type chatLocalHandler struct {
	*BaseHandler
	libkb.Contextified
	gh   *gregorHandler
	tlfh *tlfHandler
}

func newChatLocalHandler(xp rpc.Transporter, g *libkb.GlobalContext, gh *gregorHandler) *chatLocalHandler {
	return &chatLocalHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		gh:           gh,
		tlfh:         newTlfHandler(xp, g),
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

	return h.unboxThread(ctx, boxed)
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

func (h *chatLocalHandler) unboxThread(ctx context.Context, boxed chat1.ThreadViewBoxed) (keybase1.ThreadView, error) {
	thread := keybase1.ThreadView{
		Pagination: boxed.Pagination,
	}

	for _, msg := range boxed.Messages {
		unboxed, err := h.unboxMessage(ctx, msg)
		if err != nil {
			return keybase1.ThreadView{}, err
		}
		thread.Messages = append(thread.Messages, unboxed)
	}

	return thread, nil
}

func (h *chatLocalHandler) unboxMessage(ctx context.Context, msg chat1.MessageBoxed) (keybase1.Message, error) {
	if msg.ServerHeader == nil {
		return keybase1.Message{}, errors.New("nil ServerHeader in MessageBoxed")
	}

	unboxed := keybase1.Message{
		ServerHeader: *msg.ServerHeader,
		MessagePlaintext: keybase1.MessagePlaintext{
			ClientHeader: msg.ClientHeader,
		},
	}

	tlfName := msg.ClientHeader.TlfName
	keys, err := h.tlfKeys(ctx, tlfName)
	if err != nil {
		return keybase1.Message{}, err
	}

	var keyBytes *keybase1.Bytes32
	for _, key := range keys.CryptKeys {
		if key.KeyGeneration == msg.KeyGeneration {
			keyBytes = &key.Key
		}
	}

	if keyBytes == nil {
		return keybase1.Message{}, fmt.Errorf("no key found for generation %d", msg.KeyGeneration)
	}

	return unboxed, nil
}

func (h *chatLocalHandler) tlfKeys(ctx context.Context, tlfName string) (keybase1.TLFCryptKeys, error) {
	return h.tlfh.CryptKeys(ctx, tlfName)
}

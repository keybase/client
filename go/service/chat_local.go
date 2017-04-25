// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

// chatLocalHandler implements keybase1.chatLocal.
type chatLocalHandler struct {
	*BaseHandler
	*chat.Server
}

// newChatLocalHandler creates a chatLocalHandler.
func newChatLocalHandler(xp rpc.Transporter, g *globals.Context, store *chat.AttachmentStore, gh *gregorHandler) *chatLocalHandler {
	h := &chatLocalHandler{
		BaseHandler: NewBaseHandler(xp),
	}
	h.Server = chat.NewServer(g, store, gh, h)
	return h
}

func (h *chatLocalHandler) GetChatUI(sessionID int) libkb.ChatUI {
	return h.BaseHandler.getChatUI(sessionID)
}

func (h *chatLocalHandler) GetStreamUICli() *keybase1.StreamUiClient {
	return h.BaseHandler.getStreamUICli()
}

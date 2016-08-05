// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type KBFSHandler struct {
	libkb.Contextified
}

type KBFSRPCHandler struct {
	*BaseHandler
	*KBFSHandler
}

func NewKBFSHandler(g *libkb.GlobalContext) *KBFSHandler {
	return &KBFSHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func NewKBFSRPCHandler(xp rpc.Transporter, g *libkb.GlobalContext) *KBFSRPCHandler {
	return &KBFSRPCHandler{
		BaseHandler: NewBaseHandler(xp),
		KBFSHandler: NewKBFSHandler(g),
	}
}

func (h *KBFSHandler) FSEvent(_ context.Context, arg keybase1.FSNotification) error {
	h.G().NotifyRouter.HandleFSActivity(arg)
	return nil
}

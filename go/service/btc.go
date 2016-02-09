// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type BTCHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewBTCHandler(xp rpc.Transporter, g *libkb.GlobalContext) *BTCHandler {
	return &BTCHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

// BTC creates a BTCEngine and runs it.
func (h *BTCHandler) RegisterBTC(_ context.Context, arg keybase1.RegisterBTCArg) error {
	ctx := engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewBTCEngine(arg.Address, arg.Force, h.G())
	return engine.RunEngine(eng, &ctx)
}

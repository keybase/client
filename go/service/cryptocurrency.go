// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CryptocurrencyHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewCryptocurrencyHandler(xp rpc.Transporter, g *libkb.GlobalContext) *CryptocurrencyHandler {
	return &CryptocurrencyHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

// BTC creates a BTCEngine and runs it.
func (h *CryptocurrencyHandler) RegisterAddress(_ context.Context, arg keybase1.RegisterAddressArg) error {
	ctx := engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewCryptocurrencyEngine(h.G(), arg)
	return engine.RunEngine(eng, &ctx)
}

func (h *CryptocurrencyHandler) RegisterBTC(_ context.Context, arg keybase1.RegisterBTCArg) error {
	ctx := engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewCryptocurrencyEngine(h.G(), keybase1.RegisterAddressArg{Address: arg.Address, Force: arg.Force})
	return engine.RunEngine(eng, &ctx)
}

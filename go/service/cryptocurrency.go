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
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

// BTC creates a BTCEngine and runs it.
func (h *CryptocurrencyHandler) RegisterAddress(nctx context.Context, arg keybase1.RegisterAddressArg) (keybase1.RegisterAddressRes, error) {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewCryptocurrencyEngine(h.G(), arg)
	m := libkb.NewMetaContext(nctx, h.G()).WithUIs(uis)
	err := engine.RunEngine2(m, eng)
	res := eng.Result()
	return res, err
}

func (h *CryptocurrencyHandler) RegisterBTC(nctx context.Context, arg keybase1.RegisterBTCArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	m := libkb.NewMetaContext(nctx, h.G()).WithUIs(uis)
	eng := engine.NewCryptocurrencyEngine(h.G(), keybase1.RegisterAddressArg{Address: arg.Address, Force: arg.Force})
	return engine.RunEngine2(m, eng)
}

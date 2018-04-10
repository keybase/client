// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for wallet operations

package service

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarsvc"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type walletHandler struct {
	libkb.Contextified
	*BaseHandler
	*stellarsvc.Server
}

var _ stellar1.LocalInterface = (*walletHandler)(nil)

func newWalletHandler(xp rpc.Transporter, g *libkb.GlobalContext) *walletHandler {
	h := &walletHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(g, xp),
	}

	h.Server = stellarsvc.New(g, h, remote.NewRemoteNet(g))

	return h
}

func (h *walletHandler) SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI {
	return h.BaseHandler.getSecretUI(sessionID, g)
}

// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for wallet operations

package service

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/stellarsvc"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type walletHandler struct {
	libkb.Contextified
	*BaseHandler
}

var _ keybase1.WalletInterface = (*walletHandler)(nil)

func newWalletHandler(xp rpc.Transporter, g *libkb.GlobalContext) *walletHandler {
	return &walletHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(g, xp),
	}
}

func (h *walletHandler) assertLoggedIn(ctx context.Context) error {
	loggedIn := h.G().ActiveDevice.Valid()
	if !loggedIn {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func (h *walletHandler) WalletInit(ctx context.Context) (err error) {
	ctx = libkb.WithLogTag(ctx, "WA")
	defer h.G().CTraceTimed(ctx, "WalletInit", func() error { return err })()
	err = h.assertLoggedIn(ctx)
	if err != nil {
		return err
	}
	_, err = stellarsvc.CreateWallet(ctx, h.G())
	return err
}

type balancesResult struct {
	Status   libkb.AppStatus    `json:"status"`
	Balances []stellar1.Balance `json:"balances"`
}

func (b *balancesResult) GetAppStatus() *libkb.AppStatus {
	return &b.Status
}

func (h *walletHandler) BalancesLocal(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/balances",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		NetContext:  ctx,
	}

	var res balancesResult
	if err := h.G().API.GetDecode(apiArg, &res); err != nil {
		return nil, err
	}

	return res.Balances, nil
}

func (h *walletHandler) SendLocal(ctx context.Context, arg stellar1.SendLocalArg) (stellar1.PaymentResult, error) {
	return stellar1.PaymentResult{}, nil
}

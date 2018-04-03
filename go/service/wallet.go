// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// RPC handlers for wallet operations

package service

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
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

	h.Server = stellarsvc.New(g, h)

	return h
}

func (h *walletHandler) SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI {
	return h.BaseHandler.getSecretUI(sessionID, g)
}

/*
func (h *walletHandler) assertLoggedIn(ctx context.Context) error {
	loggedIn := h.G().ActiveDevice.Valid()
	if !loggedIn {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func (h *walletHandler) logTag(ctx context.Context) context.Context {
	return libkb.WithLogTag(ctx, "WA")
}

func (h *walletHandler) WalletInitLocal(ctx context.Context) (err error) {
	ctx = h.logTag(ctx)
	defer h.G().CTraceTimed(ctx, "WalletInitLocal", func() error { return err })()
	err = h.assertLoggedIn(ctx)
	if err != nil {
		return err
	}
	_, err = stellarsvc.CreateWallet(ctx, h.G())
	return err
}

func (h *walletHandler) BalancesLocal(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	var err error
	ctx = h.logTag(ctx)
	defer h.G().CTraceTimed(ctx, "BalancesLocal", func() error { return err })()
	if err = h.assertLoggedIn(ctx); err != nil {
		return nil, err
	}

	return stellarsvc.Balances(ctx, h.G(), accountID)
}

func (h *walletHandler) SendLocal(ctx context.Context, arg stellar1.SendLocalArg) (stellar1.PaymentResult, error) {
	var err error
	ctx = h.logTag(ctx)
	defer h.G().CTraceTimed(ctx, "SendLocal", func() error { return err })()
	if err = h.assertLoggedIn(ctx); err != nil {
		return stellar1.PaymentResult{}, err
	}

	return stellarsvc.Send(ctx, h.G(), arg)
}

func (h *walletHandler) WalletDumpLocal(ctx context.Context) (dump stellar1.Bundle, err error) {
	ctx = h.logTag(ctx)
	defer h.G().CTraceTimed(ctx, "WalletDumpLocal", func() error { return err })()
	if h.G().Env.GetRunMode() != libkb.DevelRunMode {
		return dump, errors.New("WalletDump only supported in devel run mode")
	}

	ctx = h.logTag(ctx)
	defer h.G().CTraceTimed(ctx, "WalletDump", func() error { return err })()
	err = h.assertLoggedIn(ctx)
	if err != nil {
		return dump, err
	}

	// verify passphrase
	username := h.G().GetEnv().GetUsername().String()

	arg := libkb.DefaultPassphrasePromptArg(h.G(), username)
	secretUI := h.getSecretUI(0, h.G())
	res, err := secretUI.GetPassphrase(arg, nil)
	if err != nil {
		return dump, err
	}
	pwdOk := false
	_, err = h.G().LoginState().VerifyPlaintextPassphrase(res.Passphrase, func(lctx libkb.LoginContext) error {
		pwdOk = true

		return nil
	})
	if err != nil {
		return dump, err
	}
	if !pwdOk {
		return dump, libkb.PassphraseError{}
	}
	return stellarsvc.Dump(ctx, h.G())
}

func (h *walletHandler) OwnAccountLocal(ctx context.Context, accountID stellar1.AccountID) (isOwn bool, err error) {
	ctx = h.logTag(ctx)
	defer h.G().CTraceTimed(ctx, "OwnAccountLocal", func() error { return err })()
	err = h.assertLoggedIn(ctx)
	if err != nil {
		return false, err
	}
	return stellarsvc.OwnAccount(ctx, h.G(), accountID)
}

func (h *walletHandler) ImportSecretKeyLocal(ctx context.Context, arg stellar1.ImportSecretKeyLocalArg) (err error) {
	ctx = h.logTag(ctx)
	defer h.G().CTraceTimed(ctx, "ImportSecretKeyLocal", func() error { return err })()
	err = h.assertLoggedIn(ctx)
	if err != nil {
		return err
	}
	err = stellarsvc.ImportSecretKey(ctx, h.G(), arg.SecretKey, arg.MakePrimary)
	return err
}
*/

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type crypto struct {
	libkbfs.CryptoClient
}

func newCrypto(config libkbfs.Config, kbCtx *libkb.GlobalContext, log logger.Logger) *crypto {
	return &crypto{
		CryptoClient: *libkbfs.NewCryptoClient(config, &cryptoClient{ctx: kbCtx}, log),
	}
}

type cryptoClient struct {
	ctx *libkb.GlobalContext
}

var _ libkbfs.CryptoClientProvider = (*cryptoClient)(nil)

func (c cryptoClient) SignED25519(_ context.Context, arg keybase1.SignED25519Arg) (keybase1.ED25519SignatureInfo, error) {
	return engine.SignED25519(c.ctx, c.ctx.UI.GetSecretUI(), arg)
}

func (c cryptoClient) SignToString(_ context.Context, arg keybase1.SignToStringArg) (string, error) {
	return engine.SignToString(c.ctx, c.ctx.UI.GetSecretUI(), arg)
}

func (c cryptoClient) UnboxBytes32(ctx context.Context, arg keybase1.UnboxBytes32Arg) (keybase1.Bytes32, error) {
	return engine.UnboxBytes32(c.ctx, c.ctx.UI.GetSecretUI(), arg)
}

func (c cryptoClient) UnboxBytes32Any(ctx context.Context, arg keybase1.UnboxBytes32AnyArg) (keybase1.UnboxAnyRes, error) {
	return engine.UnboxBytes32Any(c.ctx, c.ctx.UI.GetSecretUI(), arg)
}

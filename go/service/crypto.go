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

type CryptoHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewCryptoHandler(xp rpc.Transporter, g *libkb.GlobalContext) *CryptoHandler {
	return &CryptoHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CryptoHandler) SignED25519(_ context.Context, arg keybase1.SignED25519Arg) (keybase1.ED25519SignatureInfo, error) {
	return engine.SignED25519(c.G(), c.getSecretUI(arg.SessionID), arg)
}

func (c *CryptoHandler) SignToString(_ context.Context, arg keybase1.SignToStringArg) (string, error) {
	return engine.SignToString(c.G(), c.getSecretUI(arg.SessionID), arg)
}

func (c *CryptoHandler) UnboxBytes32(_ context.Context, arg keybase1.UnboxBytes32Arg) (keybase1.Bytes32, error) {
	return engine.UnboxBytes32(c.G(), c.getSecretUI(arg.SessionID), arg)
}

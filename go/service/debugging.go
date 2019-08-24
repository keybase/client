// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type DebuggingHandler struct {
	libkb.Contextified
	*BaseHandler
	userHandler   *UserHandler
	walletHandler *walletHandler
}

func NewDebuggingHandler(xp rpc.Transporter, g *libkb.GlobalContext, userHandler *UserHandler, walletHandler *walletHandler) *DebuggingHandler {
	return &DebuggingHandler{
		Contextified:  libkb.NewContextified(g),
		BaseHandler:   NewBaseHandler(g, xp),
		userHandler:   userHandler,
		walletHandler: walletHandler,
	}
}

func (t *DebuggingHandler) FirstStep(ctx context.Context, arg keybase1.FirstStepArg) (result keybase1.FirstStepResult, err error) {
	client := t.rpcClient()
	cbArg := keybase1.SecondStepArg{Val: arg.Val + 1, SessionID: arg.SessionID}
	var cbReply int
	err = client.Call(ctx, "keybase.1.debugging.secondStep", []interface{}{cbArg}, &cbReply)
	if err != nil {
		return
	}

	result.ValPlusTwo = cbReply
	return
}

func (t *DebuggingHandler) SecondStep(_ context.Context, arg keybase1.SecondStepArg) (val int, err error) {
	val = arg.Val + 1
	return
}

func (t *DebuggingHandler) Increment(_ context.Context, arg keybase1.IncrementArg) (val int, err error) {
	val = arg.Val + 1
	return
}

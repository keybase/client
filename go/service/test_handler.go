// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type TestHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewTestHandler(xp rpc.Transporter, g *libkb.GlobalContext) *TestHandler {
	return &TestHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (t TestHandler) Test(ctx context.Context, arg keybase1.TestArg) (test keybase1.Test, err error) {
	client := t.rpcClient()
	cbArg := keybase1.TestCallbackArg{Name: arg.Name, SessionID: arg.SessionID}
	var cbReply string
	err = client.Call(ctx, "keybase.1.test.testCallback", []interface{}{cbArg}, &cbReply)
	if err != nil {
		return
	}

	test.Reply = cbReply
	return
}

func (t TestHandler) TestCallback(_ context.Context, arg keybase1.TestCallbackArg) (s string, err error) {
	return
}

func (t TestHandler) Panic(_ context.Context, message string) error {
	t.G().Log.Info("Received panic() RPC")
	go func() {
		panic(message)
	}()
	return nil
}

// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type FooHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewFooHandler(xp rpc.Transporter, g *libkb.GlobalContext) *FooHandler {
	return &FooHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

// Foo creates a FooEngine and runs it.
func (h *FooHandler) Foo(_ context.Context, arg keybase1.FooArg) error {
	ctx := engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng := engine.NewFooEngine(arg.Name, h.G())
	return engine.RunEngine(eng, &ctx)
}

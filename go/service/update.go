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

type UpdateHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewUpdateHandler(xp rpc.Transporter, g *libkb.GlobalContext) *UpdateHandler {
	return &UpdateHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *UpdateHandler) Update(_ context.Context, arg keybase1.UpdateArg) (result keybase1.UpdateResult, err error) {
	ctx := engine.Context{
		UpdateUI: h.getUpdateUI(),
	}
	eng := engine.NewUpdateEngine(h.G(), arg.Config, arg.CheckOnly)
	err = engine.RunEngine(eng, &ctx)
	if err != nil {
		return
	}
	result = keybase1.UpdateResult{Update: eng.Result}
	return
}

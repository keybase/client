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

type TeamsHandler struct {
	*BaseHandler
	libkb.Contextified
	connID libkb.ConnectionID
}

func NewTeamsHandler(xp rpc.Transporter, id libkb.ConnectionID, g *libkb.GlobalContext) *TeamsHandler {
	return &TeamsHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
		connID:       id,
	}
}

func (h *TeamsHandler) TeamCreate(netCtx context.Context, arg keybase1.TeamCreateArg) (err error) {
	ctx := engine.Context{
		LogUI:      h.getLogUI(arg.SessionID),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		NetContext: netCtx,
		SessionID:  arg.SessionID,
	}
	eng := engine.NewTeamCreateEngine(h.G(), arg.Name)
	return engine.RunEngine(eng, &ctx)
}

func (h *TeamsHandler) TeamGet(netCtx context.Context, arg keybase1.TeamGetArg) (err error) {
	ctx := engine.Context{
		LogUI:      h.getLogUI(arg.SessionID),
		NetContext: netCtx,
		SessionID:  arg.SessionID,
	}
	eng := engine.NewTeamGet(h.G(), arg)
	return engine.RunEngine(eng, &ctx)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type RevokeHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewRevokeHandler(xp rpc.Transporter, g *libkb.GlobalContext) *RevokeHandler {
	return &RevokeHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *RevokeHandler) RevokeKey(ctx context.Context, arg keybase1.RevokeKeyArg) error {
	sessionID := arg.SessionID
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewRevokeKeyEngine(h.G(), arg.KeyID)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *RevokeHandler) RevokeDevice(ctx context.Context, arg keybase1.RevokeDeviceArg) error {
	sessionID := arg.SessionID
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewRevokeDeviceEngine(h.G(), engine.RevokeDeviceEngineArgs{ID: arg.DeviceID, ForceSelf: arg.ForceSelf, ForceLast: arg.ForceLast})
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *RevokeHandler) RevokeSigs(ctx context.Context, arg keybase1.RevokeSigsArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewRevokeSigsEngine(h.G(), arg.SigIDQueries)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

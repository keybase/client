// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type RevokeHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewRevokeHandler(xp rpc.Transporter, g *libkb.GlobalContext) *RevokeHandler {
	return &RevokeHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *RevokeHandler) RevokeKey(_ context.Context, arg keybase1.RevokeKeyArg) error {
	sessionID := arg.SessionID
	ctx := engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewRevokeKeyEngine(arg.KeyID, h.G())
	return engine.RunEngine(eng, &ctx)
}

func (h *RevokeHandler) RevokeDevice(_ context.Context, arg keybase1.RevokeDeviceArg) error {
	sessionID := arg.SessionID
	ctx := engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewRevokeDeviceEngine(engine.RevokeDeviceEngineArgs{ID: arg.DeviceID, Force: arg.Force}, h.G())
	return engine.RunEngine(eng, &ctx)
}

func (h *RevokeHandler) RevokeSigs(_ context.Context, arg keybase1.RevokeSigsArg) error {
	ctx := engine.Context{
		LogUI:    h.getLogUI(arg.SessionID),
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	eng := engine.NewRevokeSigsEngine(arg.SigIDs, h.G())
	return engine.RunEngine(eng, &ctx)
}

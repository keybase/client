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

type PaperProvisionHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewPaperProvisionHandler(xp rpc.Transporter, g *libkb.GlobalContext) *PaperProvisionHandler {
	return &PaperProvisionHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *PaperProvisionHandler) PaperProvision(ctx context.Context, arg keybase1.PaperProvisionArg) error {
	uis := libkb.UIs{
		LogUI:       h.getLogUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID, h.G()),
		LoginUI:     h.getLoginUI(arg.SessionID),
		ProvisionUI: h.getProvisionUI(arg.SessionID),
		SessionID:   arg.SessionID,
	}
	eng := engine.NewPaperProvisionEngine(h.G(), arg.Username, arg.DeviceName, arg.PaperKey)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type SecretKeysHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewSecretKeysHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SecretKeysHandler {
	return &SecretKeysHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *SecretKeysHandler) GetSecretKeys(ctx context.Context, sessionID int) (keybase1.SecretKeys, error) {
	if h.G().Env.GetRunMode() == libkb.ProductionRunMode {
		return keybase1.SecretKeys{}, errors.New("GetSecretKeys is a devel-only RPC")
	}
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		SessionID: sessionID,
	}
	eng := engine.NewSecretKeysEngine(h.G())
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	err := engine.RunEngine2(m, eng)
	if err != nil {
		return keybase1.SecretKeys{}, err
	}
	return eng.Result(), nil
}

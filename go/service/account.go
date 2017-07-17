// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

type AccountHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewAccountHandler(xp rpc.Transporter, g *libkb.GlobalContext) *AccountHandler {
	return &AccountHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *AccountHandler) PassphraseChange(_ context.Context, arg keybase1.PassphraseChangeArg) error {
	eng := engine.NewPassphraseChange(&arg, h.G())
	ctx := &engine.Context{
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	return engine.RunEngine(eng, ctx)
}

func (h *AccountHandler) PassphrasePrompt(_ context.Context, arg keybase1.PassphrasePromptArg) (keybase1.GetPassphraseRes, error) {
	ui := h.getSecretUI(arg.SessionID, h.G())
	if h.G().UIRouter != nil {
		delegateUI, err := h.G().UIRouter.GetSecretUI(arg.SessionID)
		if err != nil {
			return keybase1.GetPassphraseRes{}, err
		}
		if delegateUI != nil {
			ui = delegateUI
			h.G().Log.Debug("using delegate secret UI")
		}
	}

	return ui.GetPassphrase(arg.GuiArg, nil)
}

func (h *AccountHandler) EmailChange(nctx context.Context, arg keybase1.EmailChangeArg) error {
	ctx := &engine.Context{
		SessionID:  arg.SessionID,
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		NetContext: nctx,
	}
	eng := engine.NewEmailChange(&arg, h.G())
	return engine.RunEngine(eng, ctx)
}

func (h *AccountHandler) HasServerKeys(_ context.Context, sessionID int) (keybase1.HasServerKeysRes, error) {
	arg := keybase1.HasServerKeysArg{SessionID: sessionID}
	var res keybase1.HasServerKeysRes
	eng := engine.NewHasServerKeys(&arg, h.G())
	ctx := &engine.Context{
		SessionID: arg.SessionID,
	}
	err := engine.RunEngine(eng, ctx)
	if err != nil {
		return res, err
	}
	return eng.GetResult(), nil
}

func (h *AccountHandler) ResetAccount(ctx context.Context, sessionID int) error {
	if h.G().Env.GetRunMode() != libkb.DevelRunMode {
		return errors.New("ResetAccount only supported in devel run mode")
	}

	h.G().Log.Debug("resetting account for %s", h.G().Env.GetUsername())

	err := h.G().LoginState().ResetAccount(h.G().Env.GetUsername().String())
	if err != nil {
		return err
	}

	h.G().Log.Debug("reset account succeeded, logging out.")

	return h.G().Logout()
}

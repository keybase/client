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

type AccountHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewAccountHandler(xp rpc.Transporter, g *libkb.GlobalContext) *AccountHandler {
	return &AccountHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *AccountHandler) PassphraseChange(ctx context.Context, arg keybase1.PassphraseChangeArg) error {
	eng := engine.NewPassphraseChange(h.G(), &arg)
	uis := libkb.UIs{
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
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
	uis := libkb.UIs{
		SessionID: arg.SessionID,
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
	}
	m := libkb.NewMetaContext(nctx, h.G()).WithUIs(uis)
	eng := engine.NewEmailChange(h.G(), &arg)
	return engine.RunEngine2(m, eng)
}

func (h *AccountHandler) HasServerKeys(ctx context.Context, sessionID int) (res keybase1.HasServerKeysRes, err error) {
	arg := keybase1.HasServerKeysArg{SessionID: sessionID}
	eng := engine.NewHasServerKeys(h.G())
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(libkb.UIs{SessionID: arg.SessionID})
	err = engine.RunEngine2(m, eng)
	if err != nil {
		return res, err
	}
	return eng.GetResult(), nil
}

func (h *AccountHandler) ResetAccount(ctx context.Context, sessionID int) error {
	if h.G().Env.GetRunMode() != libkb.DevelRunMode {
		return errors.New("ResetAccount only supported in devel run mode")
	}

	m := libkb.NewMetaContext(ctx, h.G())

	username := h.G().GetEnv().GetUsername().String()
	m.CDebugf("resetting account for %s", username)

	arg := libkb.DefaultPassphrasePromptArg(m, username)
	secretUI := h.getSecretUI(sessionID, h.G())
	res, err := secretUI.GetPassphrase(arg, nil)
	if err != nil {
		return err
	}
	_, err = h.G().LoginState().VerifyPlaintextPassphrase(m, res.Passphrase, func(lctx libkb.LoginContext) error {
		return libkb.ResetAccountWithContext(m.WithLoginContext(lctx), username)
	})
	if err != nil {
		return err
	}

	h.G().Log.Debug("reset account succeeded, logging out.")

	return h.G().Logout()
}

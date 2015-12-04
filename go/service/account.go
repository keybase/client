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
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	return engine.RunEngine(eng, ctx)
}

func (h *AccountHandler) PassphrasePrompt(_ context.Context, sessionID int) error {
	ui, err := h.G().UIRouter.GetSecretUI()
	if err != nil {
		return err
	}
	if ui == nil {
		h.G().Log.Debug("delegate secret ui unavailable, falling back to standard one")
		ui = h.getSecretUI(sessionID)
	}

	guiArg := keybase1.GUIEntryArg{
		WindowTitle: "Passphrase needed",
		Prompt:      "Please enter the passphrase to unlock your secret key",
		SubmitLabel: "Unlock",
		CancelLabel: "Cancel",
		RetryLabel:  "",
		Features: keybase1.GUIEntryFeatures{
			StoreSecret: keybase1.Feature{
				Allow:        true,
				DefaultValue: true,
				Readonly:     false,
				Label:        "Save in Keychain",
			},
			ShowTyping: keybase1.Feature{
				Allow:        false,
				Readonly:     true,
				DefaultValue: false,
				Label:        "Show typing",
			},
		},
	}

	res, err := ui.GetPassphrase(guiArg, nil)
	if err != nil {
		return err
	}

	h.G().Log.Debug("result: %+v", res)

	return nil
}

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

type LoginHandler struct {
	libkb.Contextified
	*BaseHandler
	identifyUI libkb.IdentifyUI
}

func NewLoginHandler(xp rpc.Transporter, g *libkb.GlobalContext) *LoginHandler {
	return &LoginHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *LoginHandler) GetConfiguredAccounts(_ context.Context, sessionID int) ([]keybase1.ConfiguredAccount, error) {
	return h.G().GetConfiguredAccounts()
}

func (h *LoginHandler) Logout(_ context.Context, sessionID int) error {
	return h.G().Logout()
}

func (h *LoginHandler) Deprovision(_ context.Context, arg keybase1.DeprovisionArg) error {
	eng := engine.NewDeprovisionEngine(h.G(), arg.Username, arg.DoRevoke)
	ctx := engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	return engine.RunEngine(eng, &ctx)
}

func (h *LoginHandler) RecoverAccountFromEmailAddress(_ context.Context, email string) error {
	res, err := h.G().API.Post(libkb.APIArg{
		Endpoint:    "send-reset-pw",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"email_or_username": libkb.S{Val: email},
		},
		AppStatusCodes: []int{libkb.SCOk, libkb.SCBadLoginUserNotFound},
	})
	if err != nil {
		return err
	}
	if res.AppStatus.Code == libkb.SCBadLoginUserNotFound {
		return libkb.NotFoundError{}
	}
	return nil
}

func (h *LoginHandler) ClearStoredSecret(_ context.Context, arg keybase1.ClearStoredSecretArg) error {
	return libkb.ClearStoredSecret(h.G(), libkb.NewNormalizedUsername(arg.Username))
}

func (h *LoginHandler) PaperKey(_ context.Context, sessionID int) error {
	ctx := &engine.Context{
		LogUI:     h.getLogUI(sessionID),
		LoginUI:   h.getLoginUI(sessionID),
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		SessionID: sessionID,
	}
	eng := engine.NewPaperKey(h.G())
	return engine.RunEngine(eng, ctx)
}

func (h *LoginHandler) PaperKeySubmit(_ context.Context, arg keybase1.PaperKeySubmitArg) error {
	ctx := &engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng := engine.NewPaperKeySubmit(h.G(), arg.PaperPhrase)
	return engine.RunEngine(eng, ctx)
}

func (h *LoginHandler) Unlock(_ context.Context, sessionID int) error {
	ctx := &engine.Context{
		LogUI:     h.getLogUI(sessionID),
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		SessionID: sessionID,
	}
	eng := engine.NewUnlock(h.G())
	return engine.RunEngine(eng, ctx)
}

func (h *LoginHandler) UnlockWithPassphrase(_ context.Context, arg keybase1.UnlockWithPassphraseArg) error {
	ctx := &engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewUnlockWithPassphrase(h.G(), arg.Passphrase)
	return engine.RunEngine(eng, ctx)
}

func (h *LoginHandler) Login(ctx context.Context, arg keybase1.LoginArg) error {
	ectx := &engine.Context{
		LogUI:       h.getLogUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		ProvisionUI: h.getProvisionUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID, h.G()),
		GPGUI:       h.getGPGUI(arg.SessionID),
		NetContext:  ctx,
		SessionID:   arg.SessionID,
	}
	eng := engine.NewLogin(h.G(), arg.DeviceType, arg.UsernameOrEmail, arg.ClientType)
	return engine.RunEngine(eng, ectx)
}

func (h *LoginHandler) LoginProvisionedDevice(ctx context.Context, arg keybase1.LoginProvisionedDeviceArg) error {
	eng := engine.NewLoginProvisionedDevice(h.G(), arg.Username)

	ectx := &engine.Context{
		LogUI:      h.getLogUI(arg.SessionID),
		NetContext: ctx,
		SessionID:  arg.SessionID,
	}

	if arg.NoPassphrasePrompt {
		eng.SecretStoreOnly = true
	} else {
		ectx.LoginUI = h.getLoginUI(arg.SessionID)
		ectx.SecretUI = h.getSecretUI(arg.SessionID, h.G())
	}

	return engine.RunEngine(eng, ectx)
}

func (h *LoginHandler) LoginWithPaperKey(ctx context.Context, sessionID int) error {
	ectx := &engine.Context{
		LogUI:      h.getLogUI(sessionID),
		SecretUI:   h.getSecretUI(sessionID, h.G()),
		NetContext: ctx,
		SessionID:  sessionID,
	}
	eng := engine.NewLoginWithPaperKey(h.G())
	return engine.RunEngine(eng, ectx)
}

func (h *LoginHandler) PGPProvision(ctx context.Context, arg keybase1.PGPProvisionArg) error {
	if h.G().Env.GetRunMode() == libkb.ProductionRunMode {
		return errors.New("PGPProvision is a devel-only RPC")
	}
	ectx := &engine.Context{
		LogUI:      h.getLogUI(arg.SessionID),
		LoginUI:    h.getLoginUI(arg.SessionID),
		SecretUI:   h.getSecretUI(arg.SessionID, h.G()),
		NetContext: ctx,
		SessionID:  arg.SessionID,
	}
	eng := engine.NewPGPProvision(h.G(), arg.Username, arg.DeviceName, arg.Passphrase)
	return engine.RunEngine(eng, ectx)
}

func (h *LoginHandler) AccountDelete(ctx context.Context, sessionID int) error {
	if h.G().Env.GetRunMode() == libkb.ProductionRunMode {
		return errors.New("AccountDelete is a devel-only RPC")
	}
	ectx := &engine.Context{
		LogUI:      h.getLogUI(sessionID),
		NetContext: ctx,
		SessionID:  sessionID,
	}
	eng := engine.NewAccountDelete(h.G())
	return engine.RunEngine(eng, ectx)
}

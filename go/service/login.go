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

type LoginHandler struct {
	libkb.Contextified
	*BaseHandler
	identifyUI libkb.IdentifyUI
}

func NewLoginHandler(xp rpc.Transporter, g *libkb.GlobalContext) *LoginHandler {
	return &LoginHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *LoginHandler) GetConfiguredAccounts(_ context.Context, sessionID int) ([]keybase1.ConfiguredAccount, error) {
	return h.G().GetConfiguredAccounts()
}

func (h *LoginHandler) Logout(ctx context.Context, sessionID int) (err error) {
	defer h.G().CTraceTimed(ctx, "Logout [service RPC]", func() error { return err })()
	return h.G().Logout()
}

func (h *LoginHandler) Deprovision(ctx context.Context, arg keybase1.DeprovisionArg) error {
	eng := engine.NewDeprovisionEngine(h.G(), arg.Username, arg.DoRevoke)
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
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

func (h *LoginHandler) PaperKey(ctx context.Context, sessionID int) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		LoginUI:   h.getLoginUI(sessionID),
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		SessionID: sessionID,
	}
	eng := engine.NewPaperKey(h.G())
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) PaperKeySubmit(ctx context.Context, arg keybase1.PaperKeySubmitArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng := engine.NewPaperKeySubmit(h.G(), arg.PaperPhrase)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) Unlock(ctx context.Context, sessionID int) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		SessionID: sessionID,
	}
	eng := engine.NewUnlock(h.G())
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) UnlockWithPassphrase(ctx context.Context, arg keybase1.UnlockWithPassphraseArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewUnlockWithPassphrase(h.G(), arg.Passphrase)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) Login(ctx context.Context, arg keybase1.LoginArg) error {
	uis := libkb.UIs{
		LogUI:       h.getLogUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		ProvisionUI: h.getProvisionUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID, h.G()),
		GPGUI:       h.getGPGUI(arg.SessionID),
		SessionID:   arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	eng := engine.NewLogin(h.G(), arg.DeviceType, arg.UsernameOrEmail, arg.ClientType)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) LoginProvisionedDevice(ctx context.Context, arg keybase1.LoginProvisionedDeviceArg) error {
	eng := engine.NewLoginProvisionedDevice(h.G(), arg.Username)

	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}

	if arg.NoPassphrasePrompt {
		eng.SecretStoreOnly = true
	} else {
		uis.LoginUI = h.getLoginUI(arg.SessionID)
		uis.SecretUI = h.getSecretUI(arg.SessionID, h.G())
	}

	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) LoginWithPaperKey(ctx context.Context, sessionID int) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		SessionID: sessionID,
	}
	eng := engine.NewLoginWithPaperKey(h.G())
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) PGPProvision(ctx context.Context, arg keybase1.PGPProvisionArg) error {
	if h.G().Env.GetRunMode() == libkb.ProductionRunMode {
		return errors.New("PGPProvision is a devel-only RPC")
	}
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		LoginUI:   h.getLoginUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	eng := engine.NewPGPProvision(h.G(), arg.Username, arg.DeviceName, arg.Passphrase)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) AccountDelete(ctx context.Context, sessionID int) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		SessionID: sessionID,
		SecretUI:  h.getSecretUI(sessionID, h.G()),
	}
	eng := engine.NewAccountDelete(h.G())
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) LoginOneshot(ctx context.Context, arg keybase1.LoginOneshotArg) error {
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng := engine.NewLoginOneshot(h.G(), arg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)

}

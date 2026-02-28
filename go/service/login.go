// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type LoginHandler struct {
	libkb.Contextified
	*BaseHandler
}

func NewLoginHandler(xp rpc.Transporter, g *libkb.GlobalContext) *LoginHandler {
	return &LoginHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *LoginHandler) GetConfiguredAccounts(ctx context.Context, sessionID int) (res []keybase1.ConfiguredAccount, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace("GetConfiguredAccounts", &err)()
	return h.G().GetConfiguredAccounts(ctx)
}

func (h *LoginHandler) Logout(ctx context.Context, arg keybase1.LogoutArg) (err error) {
	defer h.G().CTrace(ctx, "Logout [service RPC]", &err)()
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LOGOUT")
	eng := engine.NewLogout(libkb.LogoutOptions{
		Force:       arg.Force,
		KeepSecrets: arg.KeepSecrets,
	})
	return engine.RunEngine2(mctx, eng)
}

func (h *LoginHandler) Deprovision(ctx context.Context, arg keybase1.DeprovisionArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace(fmt.Sprintf("Deprovision(%s)", arg.Username), &err)()
	eng := engine.NewDeprovisionEngine(h.G(), arg.Username, arg.DoRevoke, libkb.LogoutOptions{KeepSecrets: false, Force: true})
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) RecoverAccountFromEmailAddress(ctx context.Context, email string) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace("RecoverAccountFromEmailAddress", &err)()
	res, err := mctx.G().API.Post(mctx, libkb.APIArg{
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

func (h *LoginHandler) PaperKey(ctx context.Context, sessionID int) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace("PaperKey", &err)()
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

func (h *LoginHandler) PaperKeySubmit(ctx context.Context, arg keybase1.PaperKeySubmitArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace("PaperKeySubmit", &err)()
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng := engine.NewPaperKeySubmit(h.G(), arg.PaperPhrase)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) Unlock(ctx context.Context, sessionID int) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace("Unlock", &err)()
	uis := libkb.UIs{
		LogUI:     h.getLogUI(sessionID),
		SecretUI:  h.getSecretUI(sessionID, h.G()),
		SessionID: sessionID,
	}
	eng := engine.NewUnlock(h.G())
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) UnlockWithPassphrase(ctx context.Context, arg keybase1.UnlockWithPassphraseArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace("UnlockWithPassphrase", &err)()
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewUnlockWithPassphrase(h.G(), arg.Passphrase)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) Login(ctx context.Context, arg keybase1.LoginArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace(fmt.Sprintf("Login(%s)", arg.Username), &err)()
	uis := libkb.UIs{
		LogUI:       h.getLogUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		ProvisionUI: h.getProvisionUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID, h.G()),
		GPGUI:       h.getGPGUI(arg.SessionID),
		SessionID:   arg.SessionID,
	}
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	eng := engine.NewLoginWithUserSwitch(h.G(), arg.DeviceType, arg.Username, arg.ClientType, arg.DoUserSwitch)
	eng.PaperKey = arg.PaperKey
	eng.DeviceName = arg.DeviceName
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) LoginProvisionedDevice(ctx context.Context, arg keybase1.LoginProvisionedDeviceArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace(fmt.Sprintf("LoginProvisionedDevice(%s)", arg.Username), &err)()
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

func (h *LoginHandler) LoginWithPaperKey(ctx context.Context, arg keybase1.LoginWithPaperKeyArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace(fmt.Sprintf("LoginWithPaperKey(%s)", arg.Username), &err)()
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	eng := engine.NewLoginWithPaperKey(h.G(), arg.Username)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) AccountDelete(ctx context.Context, arg keybase1.AccountDeleteArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace("AccountDelete", &err)()
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
	}
	eng := engine.NewAccountDelete(h.G(), arg.Passphrase)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) LoginOneshot(ctx context.Context, arg keybase1.LoginOneshotArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace(fmt.Sprintf("LoginOneshot(%s)", arg.Username), &err)()
	uis := libkb.UIs{
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng := engine.NewLoginOneshot(h.G(), arg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

func (h *LoginHandler) IsOnline(ctx context.Context) (isOnline bool, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace("IsOnline", &err)()
	return h.G().ConnectivityMonitor.IsConnected(ctx) == libkb.ConnectivityMonitorYes, nil
}

func (h *LoginHandler) RecoverPassphrase(ctx context.Context, arg keybase1.RecoverPassphraseArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LH")
	defer mctx.Trace(fmt.Sprintf("RecoverPassphrase(%s)", arg.Username), &err)()
	uis := libkb.UIs{
		LogUI:       h.getLogUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID, h.G()),
		ProvisionUI: h.getProvisionUI(arg.SessionID),
		SessionID:   arg.SessionID,
	}
	eng := engine.NewPassphraseRecover(h.G(), arg)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

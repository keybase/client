// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type BaseHandler struct {
	xp        rpc.Transporter
	cli       *rpc.Client
	loginCli  *keybase1.LoginUiClient
	secretCli *keybase1.SecretUiClient
	logCli    *keybase1.LogUiClient
}

func NewBaseHandler(xp rpc.Transporter) *BaseHandler {
	h := &BaseHandler{xp: xp}
	h.cli = rpc.NewClient(h.xp, libkb.ErrorUnwrapper{}, nil)
	h.loginCli = &keybase1.LoginUiClient{Cli: h.cli}
	h.secretCli = &keybase1.SecretUiClient{Cli: h.cli}
	h.logCli = &keybase1.LogUiClient{Cli: h.cli}

	return h
}

type LoginUI struct {
	sessionID int
	cli       *keybase1.LoginUiClient
}

func (u *LoginUI) GetEmailOrUsername(ctx context.Context, _ int) (string, error) {
	return u.cli.GetEmailOrUsername(ctx, u.sessionID)
}

func (u *LoginUI) PromptRevokePaperKeys(ctx context.Context, arg keybase1.PromptRevokePaperKeysArg) (bool, error) {
	arg.SessionID = u.sessionID
	return u.cli.PromptRevokePaperKeys(ctx, arg)
}

func (u *LoginUI) DisplayPaperKeyPhrase(ctx context.Context, arg keybase1.DisplayPaperKeyPhraseArg) error {
	arg.SessionID = u.sessionID
	return u.cli.DisplayPaperKeyPhrase(ctx, arg)
}

func (u *LoginUI) DisplayPrimaryPaperKey(ctx context.Context, arg keybase1.DisplayPrimaryPaperKeyArg) error {
	arg.SessionID = u.sessionID
	return u.cli.DisplayPrimaryPaperKey(ctx, arg)
}

type SecretUI struct {
	sessionID int
	cli       *keybase1.SecretUiClient
	libkb.Contextified
}

// GetPassphrase gets the current keybase passphrase from delegated pinentry.
func (u *SecretUI) GetPassphrase(pinentry keybase1.GUIEntryArg, terminal *keybase1.SecretEntryArg) (keybase1.GetPassphraseRes, error) {
	u.G().Log.Debug("SecretUI:GetPassphrase, sessionID = %d", u.sessionID)
	return u.cli.GetPassphrase(context.TODO(), keybase1.GetPassphraseArg{SessionID: u.sessionID, Pinentry: pinentry, Terminal: terminal})
}

func (h *BaseHandler) rpcClient() *rpc.Client {
	return h.cli
}

func (h *BaseHandler) getLoginUICli() *keybase1.LoginUiClient {
	return h.loginCli
}

func (h *BaseHandler) getLoginUI(sessionID int) libkb.LoginUI {
	return &LoginUI{sessionID, h.getLoginUICli()}
}

func (h *BaseHandler) getGPGUI(sessionID int) libkb.GPGUI {
	return NewRemoteGPGUI(sessionID, h.rpcClient())
}

func (h *BaseHandler) getSecretUICli() *keybase1.SecretUiClient {
	return h.secretCli
}

func (h *BaseHandler) getSecretUI(sessionID int, g *libkb.GlobalContext) libkb.SecretUI {
	return &SecretUI{
		sessionID:    sessionID,
		cli:          h.getSecretUICli(),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *BaseHandler) getLogUICli() *keybase1.LogUiClient {
	return h.logCli
}

func (h *BaseHandler) getLogUI(sessionID int) libkb.LogUI {
	return &LogUI{sessionID, h.getLogUICli()}
}

func (h *BaseHandler) getProvisionUI(sessionID int) libkb.ProvisionUI {
	return NewRemoteProvisionUI(sessionID, h.rpcClient())
}

func (h *BaseHandler) getPgpUI(sessionID int) libkb.PgpUI {
	return NewRemotePgpUI(sessionID, h.rpcClient())
}

func (h *BaseHandler) getStreamUICli() *keybase1.StreamUiClient {
	return &keybase1.StreamUiClient{Cli: h.rpcClient()}
}

func (h *BaseHandler) getSaltpackUI(sessionID int) libkb.SaltpackUI {
	return NewRemoteSaltpackUI(sessionID, h.rpcClient())
}

func (h *BaseHandler) getChatUI(sessionID int) libkb.ChatUI {
	return NewRemoteChatUI(sessionID, h.rpcClient())
}

func (h *BaseHandler) NewRemoteIdentifyUI(sessionID int, g *libkb.GlobalContext) *RemoteIdentifyUI {
	c := h.rpcClient()
	return &RemoteIdentifyUI{
		sessionID:    sessionID,
		uicli:        keybase1.IdentifyUiClient{Cli: c},
		logUI:        h.getLogUI(sessionID),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *BaseHandler) NewRemoteSkipPromptIdentifyUI(sessionID int, g *libkb.GlobalContext) *RemoteIdentifyUI {
	c := h.NewRemoteIdentifyUI(sessionID, g)
	c.skipPrompt = true
	return c
}

type UpdateUI struct {
	sessionID int
	cli       *keybase1.UpdateUiClient
}

func (u *UpdateUI) UpdatePrompt(ctx context.Context, arg keybase1.UpdatePromptArg) (keybase1.UpdatePromptRes, error) {
	return u.cli.UpdatePrompt(ctx, arg)
}

func (u *UpdateUI) UpdateAppInUse(ctx context.Context, arg keybase1.UpdateAppInUseArg) (keybase1.UpdateAppInUseRes, error) {
	return u.cli.UpdateAppInUse(ctx, arg)
}

func (u *UpdateUI) UpdateQuit(ctx context.Context, arg keybase1.UpdateQuitArg) (res keybase1.UpdateQuitRes, err error) {
	return u.cli.UpdateQuit(ctx, arg)
}

type RekeyUI struct {
	libkb.Contextified
	sessionID    int
	cli          *keybase1.RekeyUIClient
	connectionID libkb.ConnectionID
}

// DelegateRekeyUI shouldn't be called on this object since it
// should already have a sessionID.
func (r *RekeyUI) DelegateRekeyUI(ctx context.Context) (int, error) {
	r.G().Log.Warning("service RekeyUI.DelegateRekeyUI() called to get session id after RekeyUI object created")
	return r.cli.DelegateRekeyUI(ctx)
}

func (r *RekeyUI) Refresh(ctx context.Context, arg keybase1.RefreshArg) error {
	arg.SessionID = r.sessionID
	return r.cli.Refresh(ctx, arg)
}

func (r *RekeyUI) RekeySendEvent(ctx context.Context, arg keybase1.RekeySendEventArg) error {
	arg.SessionID = r.sessionID
	return r.cli.RekeySendEvent(ctx, arg)
}

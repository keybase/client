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
	eng := engine.NewDeprovisionEngine(h.G(), arg.Username)
	ctx := engine.Context{
		LogUI:    h.getLogUI(arg.SessionID),
		SecretUI: h.getSecretUI(arg.SessionID),
	}
	return engine.RunEngine(eng, &ctx)
}

func (h *LoginHandler) RecoverAccountFromEmailAddress(_ context.Context, email string) error {
	res, err := h.G().API.Post(libkb.APIArg{
		Endpoint:    "send-reset-pw",
		NeedSession: false,
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
		LogUI:    h.getLogUI(sessionID),
		LoginUI:  h.getLoginUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewPaperKey(h.G())
	return engine.RunEngine(eng, ctx)
}

func (h *LoginHandler) Unlock(_ context.Context, sessionID int) error {
	ctx := &engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewUnlock(h.G())
	return engine.RunEngine(eng, ctx)
}

func (h *LoginHandler) Login(ctx context.Context, arg keybase1.LoginArg) error {
	ectx := &engine.Context{
		LogUI:       h.getLogUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		ProvisionUI: h.getProvisionUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID),
		GPGUI:       h.getGPGUI(arg.SessionID),
		NetContext:  ctx,
	}
	eng := engine.NewLogin(h.G(), arg.DeviceType, arg.Username, arg.ClientType)
	return engine.RunEngine(eng, ectx)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"

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

func (h *AccountHandler) getDelegateSecretUI(sessionID int) (ret libkb.SecretUI, err error) {
	if h.G().UIRouter != nil {
		return h.G().UIRouter.GetSecretUI(sessionID)
	}
	return nil, nil
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
	if delegateUI, err := h.getDelegateSecretUI(arg.SessionID); err != nil {
		return keybase1.GetPassphraseRes{}, err
	} else if delegateUI != nil {
		ui = delegateUI
		h.G().Log.Debug("using delegate secret UI")
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

func (h *AccountHandler) ResetAccount(ctx context.Context, arg keybase1.ResetAccountArg) (err error) {

	if h.G().Env.GetRunMode() != libkb.DevelRunMode {
		return errors.New("ResetAccount only supported in devel run mode")
	}

	m := libkb.NewMetaContext(ctx, h.G())
	defer m.Trace("AccountHandler#ResetAccount", func() error { return err })()

	username := h.G().GetEnv().GetUsername()
	m.Debug("resetting account for %s", username.String())

	passphrase := arg.Passphrase
	if passphrase == "" {
		pparg := libkb.DefaultPassphrasePromptArg(m, username.String())
		secretUI := h.getSecretUI(arg.SessionID, h.G())
		res, err := secretUI.GetPassphrase(pparg, nil)
		if err != nil {
			return err
		}
		passphrase = res.Passphrase
	}

	err = libkb.ResetAccount(m, username, passphrase)
	if err != nil {
		return err
	}

	m.Debug("reset account succeeded, logging out.")

	return h.G().Logout(m.Ctx())
}

type GetLockdownResponse struct {
	libkb.AppStatusEmbed
	Enabled bool                       `json:"enabled"`
	History []keybase1.LockdownHistory `json:"history"`
}

func (h *AccountHandler) GetLockdownMode(ctx context.Context, sessionID int) (ret keybase1.GetLockdownResponse, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("GetLockdownMode", func() error { return err })()
	apiArg := libkb.APIArg{
		Endpoint:    "account/lockdown",
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	var response GetLockdownResponse
	err = mctx.G().API.GetDecode(mctx, apiArg, &response)
	if err != nil {
		return ret, err
	}

	upak, _, err := mctx.G().GetUPAKLoader().Load(
		libkb.NewLoadUserArgWithMetaContext(mctx).WithPublicKeyOptional().WithUID(mctx.G().ActiveDevice.UID()))
	if err != nil {
		return ret, err
	}

	// Fill device names from ActiveDevices list.
	for i, v := range response.History {
		dev := upak.FindDevice(v.DeviceID)
		if dev == nil {
			mctx.Debug("GetLockdownMode: Could not find device in UserPlusAllKeys: %s", v.DeviceID)
			continue
		}

		v.DeviceName = dev.DeviceDescription
		response.History[i] = v
	}

	ret = keybase1.GetLockdownResponse{
		Status:  response.Enabled,
		History: response.History,
	}
	h.G().Log.CDebugf(ctx, "GetLockdownMode -> %v", ret.Status)
	return ret, nil
}

func (h *AccountHandler) SetLockdownMode(ctx context.Context, arg keybase1.SetLockdownModeArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed(fmt.Sprintf("SetLockdownMode(%v)", arg.Enabled), func() error { return err })()
	apiArg := libkb.APIArg{
		Endpoint:    "account/lockdown",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"enabled": libkb.B{Val: arg.Enabled},
		},
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}

func (h *AccountHandler) PassphraseCheck(ctx context.Context, arg keybase1.PassphraseCheckArg) (ret bool, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace("PassphraseCheck", func() error { return err })()
	eng := engine.NewPassphraseCheck(mctx.G(), &arg)
	uis := libkb.UIs{
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		SessionID: arg.SessionID,
	}
	err = eng.Run(mctx.WithUIs(uis))
	return eng.GetResult(), err
}

func (h *AccountHandler) RecoverUsernameWithEmail(ctx context.Context, arg keybase1.RecoverUsernameWithEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed(fmt.Sprintf("RecoverUsernameWithEmail(%q)", arg.Email), func() error { return err })()
	apiArg := libkb.APIArg{
		Endpoint:    "account/recover_username",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"email": libkb.S{Val: arg.Email},
		},
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}

func (h *AccountHandler) RecoverUsernameWithPhone(ctx context.Context, arg keybase1.RecoverUsernameWithPhoneArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed(fmt.Sprintf("RecoverUsernameWithPhone(%q)", arg.Phone), func() error { return err })()
	if err = libkb.IsPossiblePhoneNumber(arg.Phone); err != nil {
		return err
	}
	apiArg := libkb.APIArg{
		Endpoint:    "account/recover_username",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"phone_number": libkb.S{Val: arg.Phone.String()},
		},
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}

// EnterPipeline allows a user to enter the reset pipeline. The user must
// verify ownership of the account via an email confirmation or their password.
// Resets are not allowed on a provisioned device.
func (h *AccountHandler) EnterResetPipeline(ctx context.Context, arg keybase1.EnterResetPipelineArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("EnterResetPipline", func() error { return err })()
	uis := libkb.UIs{
		LoginUI:   h.getLoginUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		LogUI:     h.getLogUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	eng := engine.NewAccountReset(h.G(), arg.UsernameOrEmail)
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	return engine.RunEngine2(m, eng)
}

// CancelReset allows a user to cancel the reset process via an authenticated API call.
func (h *AccountHandler) CancelReset(ctx context.Context, sessionID int) error {
	mctx := libkb.NewMetaContext(ctx, h.G())
	return libkb.CancelResetPipeline(mctx)
}

// TimeTravelReset allows a user to move forward in the reset process via an authenticated API call [devel-only].
func (h *AccountHandler) TimeTravelReset(ctx context.Context, arg keybase1.TimeTravelResetArg) error {
	mctx := libkb.NewMetaContext(ctx, h.G())
	_, err := mctx.G().API.Post(mctx, libkb.APIArg{
		Endpoint:    "autoreset/timetravel",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"duration_sec": libkb.I{Val: int(arg.Duration)},
		},
	})

	return err
}

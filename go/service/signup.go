// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type SignupHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewSignupHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SignupHandler {
	return &SignupHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *SignupHandler) CheckUsernameAvailable(_ context.Context, arg keybase1.CheckUsernameAvailableArg) error {
	return engine.CheckUsernameAvailable(h.G(), arg.Username)
}

func (h *SignupHandler) Signup(_ context.Context, arg keybase1.SignupArg) (res keybase1.SignupRes, err error) {
	ctx := &engine.Context{
		LogUI:     h.getLogUI(arg.SessionID),
		GPGUI:     h.getGPGUI(arg.SessionID),
		SecretUI:  h.getSecretUI(arg.SessionID, h.G()),
		LoginUI:   h.getLoginUI(arg.SessionID),
		SessionID: arg.SessionID,
	}
	runarg := engine.SignupEngineRunArg{
		Username:    arg.Username,
		Email:       arg.Email,
		InviteCode:  arg.InviteCode,
		Passphrase:  arg.Passphrase,
		StoreSecret: arg.StoreSecret,
		DeviceName:  arg.DeviceName,
		DeviceType:  arg.DeviceType,
		SkipMail:    arg.SkipMail,
		GenPGPBatch: arg.GenPGPBatch,
		SkipPaper:   !arg.GenPaper,
	}
	eng := engine.NewSignupEngine(&runarg, h.G())
	err = engine.RunEngine(eng, ctx)

	if err == nil {
		// everything succeeded

		// these don't really matter as they aren't checked with nil err,
		// but just to make sure:
		res.PassphraseOk = true
		res.PostOk = true
		res.WriteOk = true
		return res, nil
	}

	// check to see if the error is a join engine run result:
	if e, ok := err.(engine.SignupJoinEngineRunRes); ok {
		res.PassphraseOk = e.PassphraseOk
		res.PostOk = e.PostOk
		res.WriteOk = e.WriteOk
		err = e.Err
		return res, err
	}

	// not a join engine error:
	return res, err
}

func (h *SignupHandler) InviteRequest(_ context.Context, arg keybase1.InviteRequestArg) (err error) {
	return libkb.PostInviteRequest(libkb.InviteRequestArg{
		Email:    arg.Email,
		Fullname: arg.Fullname,
		Notes:    arg.Notes,
	})
}

func (h *SignupHandler) CheckInvitationCode(_ context.Context, arg keybase1.CheckInvitationCodeArg) (err error) {
	return libkb.CheckInvitationCode(arg.InvitationCode)
}

func (h *SignupHandler) GetInvitationCode(c context.Context, sessionID int) (code string, err error) {
	return libkb.GetInvitationCode(c, h.G())
}

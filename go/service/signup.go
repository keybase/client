// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"

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
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (h *SignupHandler) CheckUsernameAvailable(ctx context.Context, arg keybase1.CheckUsernameAvailableArg) error {
	m := libkb.NewMetaContext(ctx, h.G())
	_, err := m.G().API.Get(m, libkb.APIArg{
		Endpoint:    "user/lookup",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"username": libkb.S{Val: arg.Username},
			"fields":   libkb.S{Val: "basics"},
		},
	})
	switch err := err.(type) {
	case nil:
		// User found, so the name is taken.
		return libkb.AppStatusError{
			Code: libkb.SCBadSignupUsernameTaken,
			Name: "BAD_SIGNUP_USERNAME_TAKEN",
			Desc: fmt.Sprintf("Username '%s' is taken", arg.Username),
		}
	case libkb.AppStatusError:
		switch err.Name {
		case "NOT_FOUND":
			// User not found, name is available.
			return nil
		case "DELETED":
			return libkb.AppStatusError{
				Code: libkb.SCBadSignupUsernameDeleted,
				Name: "BAD_SIGNUP_USERNAME_DELETED",
				Desc: fmt.Sprintf("Username '%s' has been deleted", arg.Username),
			}
		}
		return err
	default:
		return err
	}
}

func (h *SignupHandler) Signup(ctx context.Context, arg keybase1.SignupArg) (res keybase1.SignupRes, err error) {
	uis := libkb.UIs{
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
	m := libkb.NewMetaContext(ctx, h.G()).WithUIs(uis)
	eng := engine.NewSignupEngine(h.G(), &runarg)
	err = engine.RunEngine2(m, eng)

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

func (h *SignupHandler) InviteRequest(ctx context.Context, arg keybase1.InviteRequestArg) (err error) {
	m := libkb.NewMetaContext(ctx, h.G())
	return libkb.PostInviteRequest(m, libkb.InviteRequestArg{
		Email:    arg.Email,
		Fullname: arg.Fullname,
		Notes:    arg.Notes,
	})
}

func (h *SignupHandler) CheckInvitationCode(ctx context.Context, arg keybase1.CheckInvitationCodeArg) (err error) {
	return libkb.CheckInvitationCode(libkb.NewMetaContext(ctx, h.G()), arg.InvitationCode)
}

func (h *SignupHandler) GetInvitationCode(c context.Context, sessionID int) (code string, err error) {
	return libkb.GetInvitationCode(libkb.NewMetaContext(c, h.G()))
}

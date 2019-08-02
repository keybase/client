// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

type usernameAvailableRes struct {
	libkb.AppStatusEmbed
	Available bool   `json:"available"`
	Reason    string `json:"reason"`
}

func (h *SignupHandler) CheckUsernameAvailable(ctx context.Context, arg keybase1.CheckUsernameAvailableArg) error {
	mctx := libkb.NewMetaContext(ctx, h.G())
	var apiRes usernameAvailableRes
	err := mctx.G().API.GetDecode(mctx, libkb.APIArg{
		Endpoint:    "user/username_available",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"username": libkb.S{Val: arg.Username},
		},
	}, &apiRes)
	if err != nil {
		return err
	}
	if apiRes.Available {
		return nil
	}
	switch apiRes.Reason {
	case "invalid":
		return libkb.AppStatusError{
			Code: libkb.SCBadUsername,
			Name: "BAD_USERNAME",
			Desc: "This is not a valid username. Please pick another one.",
		}
	case "user":
		// User found, so the name is taken.
		return libkb.AppStatusError{
			Code: libkb.SCBadSignupUsernameTaken,
			Name: "BAD_SIGNUP_USERNAME_TAKEN",
			Desc: "This username is already taken! Please pick another one.",
		}
	case "user_deleted":
		return libkb.AppStatusError{
			Code: libkb.SCBadSignupUsernameDeleted,
			Name: "BAD_SIGNUP_USERNAME_DELETED",
			Desc: "This username has been deleted! Please pick another one.",
		}
	case "team":
		return libkb.AppStatusError{
			Code: libkb.SCBadSignupTeamName,
			Name: "BAD_SIGNUP_TEAM_NAME",
			Desc: "This username is already taken. Please pick another one.",
		}
	default:
		return libkb.AppStatusError{
			Code: libkb.SCGenericAPIError,
			Name: "GENERIC",
			Desc: "This username is not available.",
		}
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
		Username:                 arg.Username,
		Email:                    arg.Email,
		InviteCode:               arg.InviteCode,
		Passphrase:               arg.Passphrase,
		GenerateRandomPassphrase: arg.RandomPw,
		StoreSecret:              arg.StoreSecret,
		DeviceName:               arg.DeviceName,
		DeviceType:               arg.DeviceType,
		SkipMail:                 arg.SkipMail,
		GenPGPBatch:              arg.GenPGPBatch,
		SkipPaper:                !arg.GenPaper,
		VerifyEmail:              arg.VerifyEmail,
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

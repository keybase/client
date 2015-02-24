package main

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type SignupHandler struct {
	BaseHandler
}

func NewSignupHandler(xp *rpc2.Transport) *SignupHandler {
	return &SignupHandler{BaseHandler: BaseHandler{xp: xp}}
}

func (h *SignupHandler) CheckUsernameAvailable(username string) error {
	return engine.CheckUsernameAvailable(username)
}

func (h *SignupHandler) Signup(arg keybase_1.SignupArg) (res keybase_1.SignupRes, err error) {
	sessionID := nextSessionId()
	eng := engine.NewSignupEngine()
	ctx := &engine.Context{
		LogUI:    h.getLogUI(sessionID),
		GPGUI:    NewRemoteGPGUI(sessionID, h.getRpcClient()),
		SecretUI: h.getSecretUI(sessionID),
		LoginUI:  h.getLoginUI(sessionID),
	}
	runarg := engine.SignupEngineRunArg{
		Username:   arg.Username,
		Email:      arg.Email,
		InviteCode: arg.InviteCode,
		Passphrase: arg.Passphrase,
		DeviceName: arg.DeviceName,
	}
	err = engine.RunEngine(eng, ctx, runarg, nil)

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

func (h *SignupHandler) InviteRequest(arg keybase_1.InviteRequestArg) (err error) {
	return libkb.PostInviteRequest(libkb.InviteRequestArg{
		Email:    arg.Email,
		Fullname: arg.Fullname,
		Notes:    arg.Notes,
	})
}

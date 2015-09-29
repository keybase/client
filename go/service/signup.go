package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type SignupHandler struct {
	*BaseHandler
}

func NewSignupHandler(xp *rpc2.Transport) *SignupHandler {
	return &SignupHandler{BaseHandler: NewBaseHandler(xp)}
}

func (h *SignupHandler) CheckUsernameAvailable(arg keybase1.CheckUsernameAvailableArg) error {
	return engine.CheckUsernameAvailable(G, arg.Username)
}

func (h *SignupHandler) Signup(arg keybase1.SignupArg) (res keybase1.SignupRes, err error) {
	ctx := &engine.Context{
		LogUI:    h.getLogUI(arg.SessionID),
		GPGUI:    h.getGPGUI(arg.SessionID),
		SecretUI: h.getSecretUI(arg.SessionID),
		LoginUI:  h.getLoginUI(arg.SessionID),
	}
	runarg := engine.SignupEngineRunArg{
		Username:    arg.Username,
		Email:       arg.Email,
		InviteCode:  arg.InviteCode,
		Passphrase:  arg.Passphrase,
		StoreSecret: arg.StoreSecret,
		DeviceName:  arg.DeviceName,
	}
	eng := engine.NewSignupEngine(&runarg, G)
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

func (h *SignupHandler) InviteRequest(arg keybase1.InviteRequestArg) (err error) {
	return libkb.PostInviteRequest(libkb.InviteRequestArg{
		Email:    arg.Email,
		Fullname: arg.Fullname,
		Notes:    arg.Notes,
	})
}

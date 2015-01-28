package main

import (
	"github.com/keybase/go/libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type SignupHandler struct {
	xp *rpc2.Transport
}

func (h SignupHandler) CheckUsernameAvailable(username string) error {
	return libkb.CheckUsernameAvailable(username)
}

func (h SignupHandler) Signup(arg keybase_1.SignupArg) (res keybase_1.SignupRes, err error) {
	/*
		eng := libkb.NewSignupJoinEngine()
		seres := eng.Run(libkb.SignupJoinEngineRunArg{
			Username:   arg.Username,
			Email:      arg.Email,
			InviteCode: arg.InviteCode,
			Passphrase: arg.Passphrase,
		})
		err = seres.Error
		res.PassphraseOk = seres.PassphraseOk
		res.PostOk = seres.PostOk
		res.WriteOk = seres.WriteOk
	*/
	eng := libkb.NewSignupEngine()

	err = eng.Run(libkb.SignupEngineRunArg{
		Username:   arg.Username,
		Email:      arg.Email,
		InviteCode: arg.InviteCode,
		Passphrase: arg.Passphrase,
		DeviceName: arg.DeviceName,
	})
	if err != nil {
		return res, err
	}

	// XXX hacking these for now until engine run changes to return more details:
	res.PassphraseOk = true
	res.PostOk = true
	res.WriteOk = true

	return res, err
}

func (h SignupHandler) InviteRequest(arg keybase_1.InviteRequestArg) (err error) {
	return libkb.PostInviteRequest(libkb.InviteRequestArg{
		Email:    arg.Email,
		Fullname: arg.Fullname,
		Notes:    arg.Notes,
	})
}

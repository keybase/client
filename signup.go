
package main

import (
	"github.com/keybase/protocol/go"
	"github.com/keybase/go-libkb"
	"net"
)

type SignupHandler struct {
	conn net.Conn
}

func (h SignupHandler) CheckUsernameAvailable(arg *keybase_1.CheckUsernameAvailableArg, res *keybase_1.CheckUsernameAvailableRes) error {
	err := libkb.CheckUsernameAvailable(arg.Username)
	res.Status = libkb.ExportErrorAsStatus(err)
	return nil
}

func (h SignupHandler) Signup(arg *keybase_1.SignupArg, res *keybase_1.SignupRes) error {
	eng := libkb.NewSignupEngine()
	seres := eng.Run(libkb.SignupEngineRunArg{
		Username : arg.Username,
		Email : arg.Email,
		InviteCode : arg.InviteCode,
		Passphrase : arg.Passphrase,
	})
	res.Status = libkb.ExportErrorAsStatus(seres.Error)
	res.Body.PassphraseOk = seres.PassphraseOk
	res.Body.PostOk = seres.PostOk
	res.Body.WriteOk = seres.WriteOk

	if seres.Uid != nil {
		succ := keybase_1.SignupResSuccess{}
		copy(succ.Uid[:], (*seres.Uid)[:])
		res.Body.Success = &succ
	}
	return nil
}

func (h SignupHandler) InviteResuest(arg *keybase_1.InviteRequestArg, res *keybase_1.InviteRequestRes) error {
	err := libkb.PostInviteRequest(libkb.InviteRequestArg{
		Email : arg.Email,
		Fullname : arg.Fullname,
		Notes : arg.Notes,

	})
	res.Status = libkb.ExportErrorAsStatus(err)
	res.Body = &keybase_1.InviteRequestResBody{
		Place : 0,
		Code : "",
	}
	return nil
}

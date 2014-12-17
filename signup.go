
package main

import (
	"github.com/keybase/protocol/go"
	"github.com/keybase/go-libkb"
	"net"
)

type SignupHandler struct {
	conn net.Conn
}

func (h SignupHandler) CheckUsernameAvailable(username *string, res *keybase_1.Status) error {
	err := libkb.CheckUsernameAvailable(*username)
	*res = libkb.ExportErrorAsStatus(err)
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
	return nil
}

func (h SignupHandler) InviteRequest(arg *keybase_1.InviteRequestArg, res *keybase_1.Status) error {
	err := libkb.PostInviteRequest(libkb.InviteRequestArg{
		Email : arg.Email,
		Fullname : arg.Fullname,
		Notes : arg.Notes,

	})
	*res = libkb.ExportErrorAsStatus(err)
	return nil
}

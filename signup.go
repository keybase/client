
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
	return nil
}
func (h SignupHandler) InviteResuest(arg *keybase_1.InviteRequestArg, res *keybase_1.InviteRequestRes) error {
	return nil
}

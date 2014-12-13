
package main

import (
	"github.com/keybase/protocol/go"
	"net"
)

type SignupHandler struct {
	conn net.Conn
}	

func (h SignupHandler) CheckUsernameAvailable(arg *keybase_1.CheckUsernameAvailableArg, res *keybase_1.CheckUsernameAvailableRes) error {
	return nil
}
func (h SignupHandler) CheckEmailAvailable(arg *keybase_1.CheckEmailAvailableArg, res *keybase_1.CheckEmailAvailableRes) error {
	return nil
}
func (h SignupHandler) Signup(arg *keybase_1.SignupArg, res *keybase_1.SignupRes) error {
	return nil
}
func (h SignupHandler) InviteResuest(arg *keybase_1.InviteRequestArg, res *keybase_1.InviteRequestRes) error {
	return nil
}

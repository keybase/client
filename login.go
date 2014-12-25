package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"net"
)

type LoginHandler struct {
	conn net.Conn
}

func (h LoginHandler) Logout(arg *keybase_1.LogoutArg, res *keybase_1.Status) error {
	*res = libkb.ExportErrorAsStatus(G.LoginState.Logout())
	return nil
}
func (h LoginHandler) PassphraseLogin(arg *string, res *keybase_1.LoginRes) error {
	return nil
}
func (h LoginHandler) PubkeyLogin(arg *keybase_1.PubkeyLoginArg, res *keybase_1.LoginRes) error {
	return nil
}
func (h LoginHandler) SwitchUser(username *string, res *keybase_1.Status) error {
	return nil
}

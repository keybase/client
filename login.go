package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"net"
	fmprpc "github.com/maxtaco/go-framed-msgpack-rpc"
	"github.com/ugorji/go/codec"
	"net/rpc"
	"fmt"
)

type LoginHandler struct {
	conn net.Conn
	cli *rpc.Client
	loginCli *keybase_1.LoginUiClient
}

func (h *LoginHandler) getRpcClient() *rpc.Client {
	if h.cli == nil {
		var mh codec.MsgpackHandle
		cdc := fmprpc.MsgpackSpecRpc.ClientCodec(h.conn, &mh, true)
		h.cli = rpc.NewClientWithCodec(cdc)
	}
	return h.cli
}

func (h *LoginHandler) getLoginUiCli() *keybase_1.LoginUiClient {
	if h.loginCli == nil {
		h.loginCli = &keybase_1.LoginUiClient{h.getRpcClient()}
	}
	return h.loginCli
}

type LoginUI struct {
	cli *keybase_1.LoginUiClient
}

func (h *LoginHandler) getLoginUi() libkb.LoginUI {
	return &LoginUI { h.getLoginUiCli() }
}

func (u *LoginUI) GetEmailOrUsername() (ret keybase_1.GetEmailOrUsernameRes) {
	if err := u.cli.GetEmailOrUsername(keybase_1.GetEmailOrUsernameArg{}, &ret); err != nil {
		ret.Status = libkb.ExportErrorAsStatus(err)
	}
	return
}

func (u *LoginUI) GetKeybasePassphrase(retry string) (ret keybase_1.GetKeybasePassphraseRes) {
	fmt.Printf("ok, got to part A\n")
	if err := u.cli.GetKeybasePassphrase(retry, &ret); err != nil {
		ret.Status = libkb.ExportErrorAsStatus(err)
	}
	return
}

func (h *LoginHandler) Logout(arg *keybase_1.LogoutArg, res *keybase_1.Status) error {
	*res = libkb.ExportErrorAsStatus(G.LoginState.Logout())
	return nil
}

func (h *LoginHandler) PassphraseLogin(arg *keybase_1.PassphraseLoginArg, res *keybase_1.Status) error {
	loginui := h.getLoginUi()
	*res = libkb.ExportErrorAsStatus(libkb.LoginAndIdentify(loginui, nil))	
	return nil
}

func (h *LoginHandler) PubkeyLogin(arg *keybase_1.PubkeyLoginArg, res *keybase_1.Status) error {
	return nil
}

func (h *LoginHandler) SwitchUser(username *string, res *keybase_1.Status) error {
	return nil
}

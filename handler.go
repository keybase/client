package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type BaseHandler struct {
	xp       *rpc2.Transport
	cli      *rpc2.Client
	loginCli *keybase_1.LoginUiClient
}

type LoginUI struct {
	cli *keybase_1.LoginUiClient
}

func (h *BaseHandler) getRpcClient() *rpc2.Client {
	if h.cli == nil {
		h.cli = rpc2.NewClient(h.xp, libkb.UnwrapError)
	}
	return h.cli
}

func (h *BaseHandler) getLoginUiCli() *keybase_1.LoginUiClient {
	if h.loginCli == nil {
		h.loginCli = &keybase_1.LoginUiClient{h.getRpcClient()}
	}
	return h.loginCli
}

func (h *BaseHandler) getLoginUi() libkb.LoginUI {
	return &LoginUI{h.getLoginUiCli()}
}

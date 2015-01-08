package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type BaseHandler struct {
	xp        *rpc2.Transport
	cli       *rpc2.Client
	loginCli  *keybase_1.LoginUiClient
	secretCli *keybase_1.SecretUiClient
	logCli    *keybase_1.LogUiClient
}

type LoginUI struct {
	cli *keybase_1.LoginUiClient
}

type SecretUI struct {
	cli *keybase_1.SecretUiClient
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

func (h *BaseHandler) getSecretUiCli() *keybase_1.SecretUiClient {
	if h.secretCli == nil {
		h.secretCli = &keybase_1.SecretUiClient{h.getRpcClient()}
	}
	return h.secretCli
}

func (h *BaseHandler) getSecretUI() libkb.SecretUI {
	return &SecretUI{h.getSecretUiCli()}
}

func (h *BaseHandler) getLogUICli() *keybase_1.LogUiClient {
	if h.logCli == nil {
		h.logCli = &keybase_1.LogUiClient{h.getRpcClient()}
	}
	return h.logCli
}

func (h *BaseHandler) getLogUI() libkb.LogUI {
	return &LogUI{0, h.getLogUICli()}
}

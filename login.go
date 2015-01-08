package main

import (
	"github.com/keybase/go-libkb"
	"github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type LoginHandler struct {
	BaseHandler
	loginCli   *keybase_1.LoginUiClient
	identifyUi libkb.IdentifyUI
}

func NewLoginHandler(xp *rpc2.Transport) *LoginHandler {
	return &LoginHandler{BaseHandler{xp: xp}, nil, nil}
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
	return &LoginUI{h.getLoginUiCli()}
}

func (h *LoginHandler) getIdentifyUi() libkb.IdentifyUI {
	if h.identifyUi == nil {
		h.identifyUi = NextRemoteSelfIdentifyUI(h.getRpcClient())
	}
	return h.identifyUi
}

func (u *LoginUI) GetEmailOrUsername() (ret string, err error) {
	return u.cli.GetEmailOrUsername()
}

func (u *LoginUI) GetKeybasePassphrase(username string, retry string) (string, error) {
	arg := keybase_1.GetKeybasePassphraseArg{Username: username, Retry: retry}
	return u.cli.GetKeybasePassphrase(arg)
}

func (h *LoginHandler) Logout() error {
	return G.LoginState.Logout()
}

func (h *LoginHandler) PassphraseLogin(arg keybase_1.PassphraseLoginArg) error {
	var liarg libkb.LoginAndIdentifyArg
	liarg.Login.Username = arg.Username
	liarg.Login.Passphrase = arg.Passphrase
	if len(arg.Username) > 0 && len(arg.Passphrase) > 0 {
		liarg.Login.NoUi = true
	} else {
		liarg.Login.Prompt = true
		liarg.Login.Retry = 3
		liarg.Login.Ui = h.getLoginUi()
	}

	if arg.Identify {
		liarg.IdentifyUI = h.getIdentifyUi()
	}

	return libkb.LoginAndIdentify(liarg)
}

func (h *LoginHandler) PubkeyLogin() error {
	return nil
}

func (h *LoginHandler) SwitchUser(username string) error {
	return nil
}

package main

import (
	"github.com/keybase/go/libkb"
	"github.com/keybase/go/libkb/engine"
	keybase_1 "github.com/keybase/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type LoginHandler struct {
	BaseHandler
	identifyUi libkb.IdentifyUI
}

func NewLoginHandler(xp *rpc2.Transport) *LoginHandler {
	return &LoginHandler{BaseHandler{xp: xp}, nil}
}

func (h *LoginHandler) getIdentifyUI(sessionId int, username string) libkb.IdentifyUI {
	if h.identifyUi == nil {
		h.identifyUi = NewRemoteSelfIdentifyUI(sessionId, username, h.getRpcClient())
	}
	return h.identifyUi
}

func (u *LoginUI) GetEmailOrUsername() (ret string, err error) {
	return u.cli.GetEmailOrUsername()
}

func (h *LoginHandler) Logout() error {
	return G.LoginState.Logout()
}

func (h *LoginHandler) PassphraseLogin(arg keybase_1.PassphraseLoginArg) error {
	sessid := nextSessionId()

	var liarg engine.LoginAndIdentifyArg
	liarg.Login.Username = arg.Username
	liarg.Login.Passphrase = arg.Passphrase
	if len(arg.Username) > 0 && len(arg.Passphrase) > 0 {
		liarg.Login.NoUi = true
	} else {
		liarg.Login.Prompt = true
		liarg.Login.Retry = 3
		liarg.Login.Ui = h.getLoginUI(sessid)
		liarg.Login.SecretUI = h.getSecretUI(sessid)
	}

	if arg.Identify {
		liarg.IdentifyUI = h.getIdentifyUI(sessid, arg.Username)
	}
	liarg.LogUI = h.getLogUI(sessid)

	li := engine.NewLoginEngine()
	return li.LoginAndIdentify(liarg)
}

func (h *LoginHandler) PubkeyLogin() error {
	return nil
}

func (h *LoginHandler) SwitchUser(username string) error {
	return nil
}

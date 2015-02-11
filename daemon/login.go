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
	doctorUI   libkb.DoctorUI
}

func NewLoginHandler(xp *rpc2.Transport) *LoginHandler {
	return &LoginHandler{BaseHandler: BaseHandler{xp: xp}}
}

func (h *LoginHandler) getIdentifyUI(sessionId int, username string) libkb.IdentifyUI {
	if h.identifyUi == nil {
		h.identifyUi = h.NewRemoteSelfIdentifyUI(sessionId, username)
	}
	return h.identifyUi
}

func (h *LoginHandler) getDoctorUI(sessionId int) libkb.DoctorUI {
	if h.doctorUI == nil {
		h.doctorUI = NewRemoteDoctorUI(sessionId, h.getRpcClient())
	}
	return h.doctorUI
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
	liarg.DoctorUI = h.getDoctorUI(sessid)

	li := engine.NewLoginEngine()
	return li.LoginAndIdentify(liarg)
}

func (h *LoginHandler) PubkeyLogin() error {
	return nil
}

func (h *LoginHandler) SwitchUser(username string) error {
	return nil
}

type RemoteDoctorUI struct {
	sessionId int
	uicli     keybase_1.DoctorUiClient
}

func NewRemoteDoctorUI(sessionId int, c *rpc2.Client) *RemoteDoctorUI {
	return &RemoteDoctorUI{
		sessionId: sessionId,
		uicli:     keybase_1.DoctorUiClient{c},
	}
}

func (r *RemoteDoctorUI) PromptDeviceName(sessionID int) (string, error) {
	return r.uicli.PromptDeviceName(sessionID)
}

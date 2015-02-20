package main

import (
	"github.com/keybase/go/engine"
	"github.com/keybase/go/libkb"
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

func (u *LoginUI) GetEmailOrUsername(dummy int) (ret string, err error) {
	return u.cli.GetEmailOrUsername(u.sessionId)
}

func (h *LoginHandler) Logout() error {
	return G.LoginState.Logout()
}

func (h *LoginHandler) PassphraseLogin(arg keybase_1.PassphraseLoginArg) error {
	sessid := nextSessionId()

	var liarg engine.LoginEngineArg
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

	li := engine.NewLoginEngine()
	ctx := engine.NewContext(
		h.getLogUI(sessid),
		h.getDoctorUI(sessid),
		h.getSecretUI(sessid),
		h.getLoginUI(sessid),
		NewRemoteGPGUI(sessid, h.getRpcClient()))
	return engine.RunEngine(li, ctx, liarg, nil)
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

func (r *RemoteDoctorUI) PromptDeviceName(dummy int) (string, error) {
	return r.uicli.PromptDeviceName(r.sessionId)
}

func (r *RemoteDoctorUI) SelectSigner(arg keybase_1.SelectSignerArg) (keybase_1.SelectSignerRes, error) {
	arg.SessionID = r.sessionId
	return r.uicli.SelectSigner(arg)
}

func (r *RemoteDoctorUI) DisplaySecretWords(arg keybase_1.DisplaySecretWordsArg) error {
	arg.SessionID = r.sessionId
	return r.uicli.DisplaySecretWords(arg)
}

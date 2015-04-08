package main

import (
	"sync"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type LoginHandler struct {
	BaseHandler
	identifyUi    libkb.IdentifyUI
	doctorUI      libkb.DoctorUI
	loginEngineMu sync.Mutex
	loginEngine   *engine.LoginEngine
}

func NewLoginHandler(xp *rpc2.Transport) *LoginHandler {
	return &LoginHandler{BaseHandler: BaseHandler{xp: xp}}
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

func (h *LoginHandler) Reset() error {
	eng := engine.NewResetEngine()
	ctx := engine.Context{}
	return engine.RunEngine(eng, &ctx)
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

	h.loginEngineMu.Lock()
	h.loginEngine = engine.NewLoginEngine(&liarg)
	h.loginEngineMu.Unlock()

	ctx := &engine.Context{
		LogUI:    h.getLogUI(sessid),
		DoctorUI: h.getDoctorUI(sessid),
		SecretUI: h.getSecretUI(sessid),
		LoginUI:  h.getLoginUI(sessid),
		GPGUI:    NewRemoteGPGUI(sessid, h.getRpcClient()),
	}
	err := engine.RunEngine(h.loginEngine, ctx)

	h.loginEngineMu.Lock()
	h.loginEngine = nil
	h.loginEngineMu.Unlock()

	return err
}

func (h *LoginHandler) PubkeyLogin() error {
	return nil
}

func (h *LoginHandler) SwitchUser(username string) error {
	return nil
}

func (h *LoginHandler) CancelLogin() error {
	h.loginEngineMu.Lock()
	defer h.loginEngineMu.Unlock()
	if h.loginEngine == nil {
		G.Log.Debug("CancelLogin called and there's no login engine")
		return nil
	}
	return h.loginEngine.Cancel()
}

type RemoteDoctorUI struct {
	sessionId int
	uicli     keybase_1.DoctorUiClient
}

func NewRemoteDoctorUI(sessionId int, c *rpc2.Client) *RemoteDoctorUI {
	return &RemoteDoctorUI{
		sessionId: sessionId,
		uicli:     keybase_1.DoctorUiClient{Cli: c},
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

func (r *RemoteDoctorUI) KexStatus(arg keybase_1.KexStatusArg) error {
	arg.SessionID = r.sessionId
	return r.uicli.KexStatus(arg)
}

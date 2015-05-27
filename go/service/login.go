package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type LoginHandler struct {
	*CancelHandler
	identifyUi  libkb.IdentifyUI
	locksmithUI libkb.LocksmithUI
}

func NewLoginHandler(xp *rpc2.Transport) *LoginHandler {
	return &LoginHandler{CancelHandler: NewCancelHandler(xp)}
}

func (h *LoginHandler) GetConfiguredAccounts() ([]keybase1.ConfiguredAccount, error) {
	return libkb.GetConfiguredAccounts()
}

func (h *LoginHandler) Logout() error {
	return G.Logout()
}

func (h *LoginHandler) Reset() error {
	eng := engine.NewResetEngine(G)
	ctx := engine.Context{}
	return engine.RunEngine(eng, &ctx)
}

func (h *LoginHandler) LoginWithPrompt(arg keybase1.LoginWithPromptArg) error {
	ctx := &engine.Context{
		LogUI:       h.getLogUI(arg.SessionID),
		LocksmithUI: h.getLocksmithUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		GPGUI:       NewRemoteGPGUI(arg.SessionID, h.getRpcClient()),
	}
	eng := engine.NewLoginWithPromptEngine(arg.Username, G)

	return h.loginWithEngine(eng, ctx, arg.SessionID)
}

func (h *LoginHandler) LoginWithStoredSecret(arg keybase1.LoginWithStoredSecretArg) error {
	ctx := &engine.Context{
		LogUI:       h.getLogUI(arg.SessionID),
		LocksmithUI: h.getLocksmithUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		GPGUI:       NewRemoteGPGUI(arg.SessionID, h.getRpcClient()),
	}
	loginEngine := engine.NewLoginWithStoredSecretEngine(arg.Username, G)
	return h.loginWithEngine(loginEngine, ctx, arg.SessionID)
}

func (h *LoginHandler) LoginWithPassphrase(arg keybase1.LoginWithPassphraseArg) error {
	ctx := &engine.Context{
		LogUI:       h.getLogUI(arg.SessionID),
		LocksmithUI: h.getLocksmithUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		GPGUI:       h.getGPGUI(arg.SessionID),
	}

	loginEngine := engine.NewLoginWithPassphraseEngine(arg.Username, arg.Passphrase, arg.StoreSecret, G)
	return h.loginWithEngine(loginEngine, ctx, arg.SessionID)
}

func (h *LoginHandler) ClearStoredSecret(username string) error {
	return libkb.ClearStoredSecret(username)
}

func (h *LoginHandler) loginWithEngine(eng *engine.LoginEngine, ctx *engine.Context, sessionID int) error {
	h.setCanceler(sessionID, eng)
	defer h.removeCanceler(sessionID)
	return engine.RunEngine(eng, ctx)
}

func (h *LoginHandler) CancelLogin(sessionID int) error {
	c := h.canceler(sessionID)
	if c == nil {
		G.Log.Debug("CancelLogin called and there's no login engine for sessionID %d", sessionID)
		return nil
	}
	return c.Cancel()
}

type RemoteLocksmithUI struct {
	sessionId int
	uicli     keybase1.LocksmithUiClient
}

func NewRemoteLocksmithUI(sessionId int, c *rpc2.Client) *RemoteLocksmithUI {
	return &RemoteLocksmithUI{
		sessionId: sessionId,
		uicli:     keybase1.LocksmithUiClient{Cli: c},
	}
}

func (r *RemoteLocksmithUI) PromptDeviceName(dummy int) (string, error) {
	return r.uicli.PromptDeviceName(r.sessionId)
}

func (r *RemoteLocksmithUI) SelectSigner(arg keybase1.SelectSignerArg) (keybase1.SelectSignerRes, error) {
	arg.SessionID = r.sessionId
	return r.uicli.SelectSigner(arg)
}

func (r *RemoteLocksmithUI) DeviceSignAttemptErr(arg keybase1.DeviceSignAttemptErrArg) error {
	arg.SessionID = r.sessionId
	return r.uicli.DeviceSignAttemptErr(arg)
}

func (r *RemoteLocksmithUI) DisplaySecretWords(arg keybase1.DisplaySecretWordsArg) error {
	arg.SessionID = r.sessionId
	return r.uicli.DisplaySecretWords(arg)
}

func (r *RemoteLocksmithUI) KexStatus(arg keybase1.KexStatusArg) error {
	arg.SessionID = r.sessionId
	return r.uicli.KexStatus(arg)
}

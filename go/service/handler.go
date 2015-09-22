package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type BaseHandler struct {
	xp        *rpc2.Transport
	cli       *rpc2.Client
	loginCli  *keybase1.LoginUiClient
	secretCli *keybase1.SecretUiClient
	logCli    *keybase1.LogUiClient
}

func NewBaseHandler(xp *rpc2.Transport) *BaseHandler {
	h := &BaseHandler{xp: xp}
	h.cli = rpc2.NewClient(h.xp, libkb.UnwrapError)
	h.loginCli = &keybase1.LoginUiClient{Cli: h.cli}
	h.secretCli = &keybase1.SecretUiClient{Cli: h.cli}
	h.logCli = &keybase1.LogUiClient{Cli: h.cli}

	return h
}

type LoginUI struct {
	sessionID int
	cli       *keybase1.LoginUiClient
}

func (u *LoginUI) GetEmailOrUsername(dummy int) (string, error) {
	return u.cli.GetEmailOrUsername(u.sessionID)
}

func (u *LoginUI) PromptRevokePaperKeys(arg keybase1.PromptRevokePaperKeysArg) (bool, error) {
	arg.SessionID = u.sessionID
	return u.cli.PromptRevokePaperKeys(arg)
}

func (u *LoginUI) DisplayPaperKeyPhrase(arg keybase1.DisplayPaperKeyPhraseArg) error {
	arg.SessionID = u.sessionID
	return u.cli.DisplayPaperKeyPhrase(arg)
}

func (u *LoginUI) DisplayPrimaryPaperKey(arg keybase1.DisplayPrimaryPaperKeyArg) error {
	arg.SessionID = u.sessionID
	return u.cli.DisplayPrimaryPaperKey(arg)
}

type SecretUI struct {
	sessionID int
	cli       *keybase1.SecretUiClient
}

// GetSecret gets a free-form secret from a pinentry
func (l *SecretUI) GetSecret(pinentry keybase1.SecretEntryArg, terminal *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error) {
	res, err := l.cli.GetSecret(keybase1.GetSecretArg{SessionID: l.sessionID, Pinentry: pinentry, Terminal: terminal})
	return &res, err
}

// GetNewPassphrase gets a new passphrase from pinentry
func (l *SecretUI) GetNewPassphrase(arg keybase1.GetNewPassphraseArg) (keybase1.GetNewPassphraseRes, error) {
	arg.SessionID = l.sessionID
	return l.cli.GetNewPassphrase(arg)
}

// GetKeybasePassphrase gets the current keybase passphrase from pinentry.
func (l *SecretUI) GetKeybasePassphrase(arg keybase1.GetKeybasePassphraseArg) (string, error) {
	arg.SessionID = l.sessionID
	return l.cli.GetKeybasePassphrase(arg)
}

// GetPaperKeyPassphrase gets a paper key passphrase from pinentry (if
// possible).
func (l *SecretUI) GetPaperKeyPassphrase(arg keybase1.GetPaperKeyPassphraseArg) (string, error) {
	arg.SessionID = l.sessionID
	return l.cli.GetPaperKeyPassphrase(arg)
}

func (h *BaseHandler) rpcClient() *rpc2.Client {
	return h.cli
}

func (h *BaseHandler) getLoginUICli() *keybase1.LoginUiClient {
	return h.loginCli
}

func (h *BaseHandler) getLoginUI(sessionID int) libkb.LoginUI {
	return &LoginUI{sessionID, h.getLoginUICli()}
}

func (h *BaseHandler) getLocksmithUI(sessionID int) libkb.LocksmithUI {
	return NewRemoteLocksmithUI(sessionID, h.rpcClient())
}

func (h *BaseHandler) getGPGUI(sessionID int) libkb.GPGUI {
	return NewRemoteGPGUI(sessionID, h.rpcClient())
}

func (h *BaseHandler) getSecretUICli() *keybase1.SecretUiClient {
	return h.secretCli
}

func (h *BaseHandler) getSecretUI(sessionID int) libkb.SecretUI {
	return &SecretUI{sessionID, h.getSecretUICli()}
}

func (h *BaseHandler) getLogUICli() *keybase1.LogUiClient {
	return h.logCli
}

func (h *BaseHandler) getLogUI(sessionID int) libkb.LogUI {
	return &LogUI{sessionID, h.getLogUICli()}
}

func (h *BaseHandler) getStreamUICli() *keybase1.StreamUiClient {
	return &keybase1.StreamUiClient{Cli: h.rpcClient()}
}

func (h *BaseHandler) NewRemoteSelfIdentifyUI(sessionID int) *RemoteSelfIdentifyUI {
	c := h.rpcClient()
	return &RemoteSelfIdentifyUI{RemoteBaseIdentifyUI{
		sessionID: sessionID,
		uicli:     keybase1.IdentifyUiClient{Cli: c},
		logUI:     h.getLogUI(sessionID),
	}}
}

func (h *BaseHandler) NewRemoteIdentifyUI(sessionID int) *RemoteIdentifyUI {
	c := h.rpcClient()
	return &RemoteIdentifyUI{RemoteBaseIdentifyUI{
		sessionID: sessionID,
		uicli:     keybase1.IdentifyUiClient{Cli: c},
		logUI:     h.getLogUI(sessionID),
	}}
}

func (h *BaseHandler) NewRemoteSkipPromptIdentifyUI(sessionID int) *RemoteIdentifyUI {
	c := h.NewRemoteIdentifyUI(sessionID)
	c.skipPrompt = true
	return c
}

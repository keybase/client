package service

import (
	"math"

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
	sessionId int
	cli       *keybase1.LoginUiClient
}

func (u *LoginUI) GetEmailOrUsername(dummy int) (ret string, err error) {
	return u.cli.GetEmailOrUsername(u.sessionId)
}

type SecretUI struct {
	sessionId int
	cli       *keybase1.SecretUiClient
}

// GetSecret gets a free-form secret from a pinentry
func (l *SecretUI) GetSecret(pinentry keybase1.SecretEntryArg, terminal *keybase1.SecretEntryArg) (*keybase1.SecretEntryRes, error) {
	res, err := l.cli.GetSecret(keybase1.GetSecretArg{SessionID: l.sessionId, Pinentry: pinentry, Terminal: terminal})
	return &res, err
}

// GetNewPassphrase gets a new passphrase from pinentry
func (l *SecretUI) GetNewPassphrase(arg keybase1.GetNewPassphraseArg) (string, error) {
	return l.cli.GetNewPassphrase(arg)
}

// GetKeybasePassphrase gets the current keybase passphrase from pinentry.
func (l *SecretUI) GetKeybasePassphrase(arg keybase1.GetKeybasePassphraseArg) (string, error) {
	return l.cli.GetKeybasePassphrase(arg)
}

var sessionIDch chan int

func init() {
	sessionIDch = make(chan int)
	go func() {
		for {
			// wrap after MaxInt32 to be safe
			for i := 0; i < math.MaxInt32; i++ {
				sessionIDch <- i
			}
		}
	}()
}

func nextSessionID() int {
	return <-sessionIDch
}

func (h *BaseHandler) getRpcClient() *rpc2.Client {
	return h.cli
}

func (h *BaseHandler) getLoginUICli() *keybase1.LoginUiClient {
	return h.loginCli
}

func (h *BaseHandler) getLoginUI(sessionID int) libkb.LoginUI {
	return &LoginUI{sessionID, h.getLoginUICli()}
}

func (h *BaseHandler) getLocksmithUI(sessionID int) libkb.LocksmithUI {
	return NewRemoteLocksmithUI(sessionID, h.getRpcClient())
}

func (h *BaseHandler) getGPGUI(sessionID int) libkb.GPGUI {
	return NewRemoteGPGUI(sessionID, h.getRpcClient())
}

func (h *BaseHandler) getSecretUICli() *keybase1.SecretUiClient {
	return h.secretCli
}

func (h *BaseHandler) getSecretUI(sessionId int) libkb.SecretUI {
	return &SecretUI{sessionId, h.getSecretUICli()}
}

func (h *BaseHandler) getLogUICli() *keybase1.LogUiClient {
	return h.logCli
}

func (h *BaseHandler) getLogUI(sessionId int) libkb.LogUI {
	return &LogUI{sessionId, h.getLogUICli()}
}

func (h *BaseHandler) getStreamUICli() *keybase1.StreamUiClient {
	return &keybase1.StreamUiClient{Cli: h.getRpcClient()}
}

func (h *BaseHandler) NewRemoteSelfIdentifyUI(sessionId int) *RemoteSelfIdentifyUI {
	c := h.getRpcClient()
	return &RemoteSelfIdentifyUI{RemoteBaseIdentifyUI{
		sessionId: sessionId,
		uicli:     keybase1.IdentifyUiClient{Cli: c},
		logUI:     h.getLogUI(sessionId),
	}}
}

func (h *BaseHandler) NewRemoteIdentifyUI(sessionId int) *RemoteIdentifyUI {
	c := h.getRpcClient()
	return &RemoteIdentifyUI{RemoteBaseIdentifyUI{
		sessionId: sessionId,
		uicli:     keybase1.IdentifyUiClient{Cli: c},
		logUI:     h.getLogUI(sessionId),
	}}
}

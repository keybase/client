package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	rpc "github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

type LoginHandler struct {
	libkb.Contextified
	*CancelHandler
	identifyUI  libkb.IdentifyUI
	locksmithUI libkb.LocksmithUI
}

func NewLoginHandler(xp rpc.Transporter, g *libkb.GlobalContext) *LoginHandler {
	return &LoginHandler{
		CancelHandler: NewCancelHandler(xp),
		Contextified:  libkb.NewContextified(g),
	}
}

func (h *LoginHandler) GetConfiguredAccounts(_ context.Context, sessionID int) ([]keybase1.ConfiguredAccount, error) {
	return libkb.GetConfiguredAccounts(h.G())
}

func (h *LoginHandler) Logout(_ context.Context, sessionID int) error {
	return h.G().Logout()
}

func (h *LoginHandler) Reset(_ context.Context, sessionID int) error {
	eng := engine.NewResetEngine(h.G())
	ctx := engine.Context{}
	return engine.RunEngine(eng, &ctx)
}

func (h *LoginHandler) RecoverAccountFromEmailAddress(_ context.Context, email string) error {
	res, err := h.G().API.Post(libkb.APIArg{
		Endpoint:    "send-reset-pw",
		NeedSession: false,
		Args: libkb.HTTPArgs{
			"email_or_username": libkb.S{Val: email},
		},
		AppStatus: []string{"OK", "BAD_LOGIN_USER_NOT_FOUND"},
	})
	if err != nil {
		return err
	}
	if res.AppStatus == "BAD_LOGIN_USER_NOT_FOUND" {
		return libkb.NotFoundError{}
	}
	return nil
}

func (h *LoginHandler) LoginWithPrompt(_ context.Context, arg keybase1.LoginWithPromptArg) error {
	ctx := &engine.Context{
		LogUI:       h.getLogUI(arg.SessionID),
		LocksmithUI: h.getLocksmithUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		GPGUI:       h.getGPGUI(arg.SessionID),
	}
	eng := engine.NewLoginWithPromptEngine(arg.Username, h.G())

	return h.loginWithEngine(eng, ctx, arg.SessionID)
}

func (h *LoginHandler) LoginWithStoredSecret(_ context.Context, arg keybase1.LoginWithStoredSecretArg) error {
	ctx := &engine.Context{
		LogUI:       h.getLogUI(arg.SessionID),
		LocksmithUI: h.getLocksmithUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		GPGUI:       h.getGPGUI(arg.SessionID),
	}
	loginEngine := engine.NewLoginWithStoredSecretEngine(arg.Username, h.G())
	return h.loginWithEngine(loginEngine, ctx, arg.SessionID)
}

func (h *LoginHandler) LoginWithPassphrase(_ context.Context, arg keybase1.LoginWithPassphraseArg) error {
	ctx := &engine.Context{
		LogUI:       h.getLogUI(arg.SessionID),
		LocksmithUI: h.getLocksmithUI(arg.SessionID),
		SecretUI:    h.getSecretUI(arg.SessionID),
		LoginUI:     h.getLoginUI(arg.SessionID),
		GPGUI:       h.getGPGUI(arg.SessionID),
	}

	loginEngine := engine.NewLoginWithPassphraseEngine(arg.Username, arg.Passphrase, arg.StoreSecret, h.G())
	return h.loginWithEngine(loginEngine, ctx, arg.SessionID)
}

func (h *LoginHandler) ClearStoredSecret(_ context.Context, arg keybase1.ClearStoredSecretArg) error {
	return libkb.ClearStoredSecret(libkb.NewNormalizedUsername(arg.Username))
}

func (h *LoginHandler) loginWithEngine(eng *engine.LoginEngine, ctx *engine.Context, sessionID int) error {
	h.setCanceler(sessionID, eng)
	defer h.removeCanceler(sessionID)
	err := engine.RunEngine(eng, ctx)
	if err != nil {
		if _, ok := err.(libkb.CanceledError); ok {
			h.G().Log.Debug("logging out due to login cancel")
			h.G().Logout()
		}
	}
	return err
}

func (h *LoginHandler) CancelLogin(_ context.Context, sessionID int) error {
	c := h.canceler(sessionID)
	if c == nil {
		h.G().Log.Debug("CancelLogin called and there's no login engine for sessionID %d", sessionID)
		return libkb.LoginSessionNotFound{SessionID: sessionID}
	}
	return c.Cancel()
}

func (h *LoginHandler) PaperKey(_ context.Context, sessionID int) error {
	ctx := &engine.Context{
		LogUI:    h.getLogUI(sessionID),
		LoginUI:  h.getLoginUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewPaperKey(h.G())
	return engine.RunEngine(eng, ctx)
}

func (h *LoginHandler) Unlock(_ context.Context, sessionID int) error {
	ctx := &engine.Context{
		LogUI:    h.getLogUI(sessionID),
		SecretUI: h.getSecretUI(sessionID),
	}
	eng := engine.NewUnlock(h.G())
	return engine.RunEngine(eng, ctx)
}

func (h *LoginHandler) XLogin(_ context.Context, arg keybase1.XLoginArg) error {
	ctx := &engine.Context{
		LogUI:       h.getLogUI(arg.SessionID),
		ProvisionUI: h.getProvisionUI(arg.SessionID),
	}
	eng := engine.NewXLogin(h.G(), arg.DeviceType, arg.Username)
	return engine.RunEngine(eng, ctx)
}

type RemoteLocksmithUI struct {
	sessionID int
	uicli     keybase1.LocksmithUiClient
}

func NewRemoteLocksmithUI(sessionID int, c *rpc.Client) *RemoteLocksmithUI {
	return &RemoteLocksmithUI{
		sessionID: sessionID,
		uicli:     keybase1.LocksmithUiClient{Cli: c},
	}
}

func (r *RemoteLocksmithUI) PromptDeviceName(ctx context.Context, _ int) (string, error) {
	return r.uicli.PromptDeviceName(ctx, r.sessionID)
}

func (r *RemoteLocksmithUI) DeviceNameTaken(ctx context.Context, arg keybase1.DeviceNameTakenArg) error {
	arg.SessionID = r.sessionID
	return r.uicli.DeviceNameTaken(ctx, arg)
}

func (r *RemoteLocksmithUI) SelectSigner(ctx context.Context, arg keybase1.SelectSignerArg) (keybase1.SelectSignerRes, error) {
	arg.SessionID = r.sessionID
	return r.uicli.SelectSigner(ctx, arg)
}

func (r *RemoteLocksmithUI) DeviceSignAttemptErr(ctx context.Context, arg keybase1.DeviceSignAttemptErrArg) error {
	arg.SessionID = r.sessionID
	return r.uicli.DeviceSignAttemptErr(ctx, arg)
}

func (r *RemoteLocksmithUI) DisplaySecretWords(ctx context.Context, arg keybase1.DisplaySecretWordsArg) error {
	arg.SessionID = r.sessionID
	return r.uicli.DisplaySecretWords(ctx, arg)
}

func (r *RemoteLocksmithUI) KexStatus(ctx context.Context, arg keybase1.KexStatusArg) error {
	arg.SessionID = r.sessionID
	return r.uicli.KexStatus(ctx, arg)
}

func (r *RemoteLocksmithUI) DisplayProvisionSuccess(ctx context.Context, arg keybase1.DisplayProvisionSuccessArg) error {
	arg.SessionID = r.sessionID
	return r.uicli.DisplayProvisionSuccess(ctx, arg)
}

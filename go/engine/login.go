package engine

import (
	"sync"

	"github.com/keybase/client/go/libkb"
)

type LoginEngine struct {
	libkb.Contextified
	requiredUIs []libkb.UIKind
	runFn       func(*libkb.LoginState, *Context) error
	locksmithMu sync.Mutex
	locksmith   *Locksmith
}

func NewLoginWithPromptEngine(username string) *LoginEngine {
	return &LoginEngine{
		requiredUIs: []libkb.UIKind{
			libkb.LoginUIKind,
			libkb.SecretUIKind,
		},
		runFn: func(loginState *libkb.LoginState, ctx *Context) error {
			return loginState.LoginWithPrompt(username, ctx.LoginUI, ctx.SecretUI)
		},
	}
}

func NewLoginWithStoredSecretEngine(username string) *LoginEngine {
	return &LoginEngine{
		runFn: func(loginState *libkb.LoginState, ctx *Context) error {
			return loginState.LoginWithStoredSecret(username)
		},
	}
}

func NewLoginWithPassphraseEngine(username, passphrase string, storeSecret bool) *LoginEngine {
	return &LoginEngine{
		runFn: func(loginState *libkb.LoginState, ctx *Context) error {
			return loginState.LoginWithPassphrase(username, passphrase, storeSecret)
		},
	}
}

func (e *LoginEngine) Name() string {
	return "Login"
}

func (e *LoginEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (e *LoginEngine) RequiredUIs() []libkb.UIKind {
	return e.requiredUIs
}

func (e *LoginEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{NewLocksmith()}
}

func (e *LoginEngine) Run(ctx *Context) (err error) {
	e.SetGlobalContext(ctx.GlobalContext)

	if err = e.runFn(e.G().LoginState, ctx); err != nil {
		return
	}

	var u *libkb.User

	// We might need to ID ourselves, to load us in here
	if u, err = libkb.LoadMe(libkb.LoadUserArg{ForceReload: true}); err == nil {
	} else if _, not_found := err.(libkb.NoKeyError); not_found {
		err = nil
	} else {
		return err
	}

	// create a locksmith engine to check the account
	e.locksmithMu.Lock()
	e.locksmith = NewLocksmith()
	e.locksmithMu.Unlock()
	return e.locksmith.LoginCheckup(ctx, u)
}

func (e *LoginEngine) Cancel() error {
	e.locksmithMu.Lock()
	defer e.locksmithMu.Unlock()
	if e.locksmith == nil {
		e.G().Log.Debug("LoginEngine Cancel called but locksmith is nil")
		return nil
	}

	return e.locksmith.Cancel()
}

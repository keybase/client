package engine

import (
	"sync"

	"github.com/keybase/client/go/libkb"
)

type LoginEngine struct {
	libkb.Contextified
	requiredUIs   []libkb.UIKind
	runFn         func(*libkb.LoginState, *Context) error
	user          *libkb.User
	SkipLocksmith bool
	locksmithMu   sync.Mutex
	locksmith     *Locksmith
}

func NewLoginWithPromptEngine(username string) *LoginEngine {
	return &LoginEngine{
		requiredUIs: []libkb.UIKind{
			libkb.LoginUIKind,
			libkb.SecretUIKind,
			libkb.LogUIKind,
		},
		runFn: func(loginState *libkb.LoginState, ctx *Context) error {
			return loginState.LoginWithPrompt(username, ctx.LoginUI, ctx.SecretUI)
		},
	}
}

func NewLoginWithPromptEngineSkipLocksmith(username string) *LoginEngine {
	eng := NewLoginWithPromptEngine(username)
	eng.SkipLocksmith = true
	return eng
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
	return []libkb.UIConsumer{
		&Locksmith{},
	}
}

func (e *LoginEngine) Run(ctx *Context) (err error) {
	e.SetGlobalContext(ctx.GlobalContext)

	if err = e.runFn(e.G().LoginState(), ctx); err != nil {
		return
	}

	// We might need to ID ourselves, to load us in here
	e.user, err = libkb.LoadMe(libkb.LoadUserArg{ForceReload: true})
	if err != nil {
		_, ok := err.(libkb.NoKeyError)
		if !ok {
			return err
		}
	}

	if e.SkipLocksmith {
		ctx.LogUI.Debug("skipping locksmith as requested by LoginArg")
		return nil
	}

	// create a locksmith engine to check the account
	larg := &LocksmithArg{
		User: e.user,
	}
	e.locksmithMu.Lock()
	e.locksmith = NewLocksmith(larg, e.G())
	e.locksmithMu.Unlock()
	err = e.locksmith.LoginCheckup(ctx, e.user)
	if err != nil {
		return err
	}

	/*
		e.G().LoginState().LocalSession(func(ls *Session) {
			ls.SetDeviceProvisioned()
		}, "LoginEngine - Run - Session.SetDeviceProvisioned")
	*/

	return nil
}

func (e *LoginEngine) User() *libkb.User {
	return e.user
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

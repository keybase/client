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

func NewLoginWithPromptEngine(username string, gc *libkb.GlobalContext) *LoginEngine {
	eng := &LoginEngine{
		requiredUIs: []libkb.UIKind{
			libkb.LoginUIKind,
			libkb.SecretUIKind,
			libkb.LogUIKind,
		},
		Contextified: libkb.NewContextified(gc),
	}
	eng.runFn = func(loginState *libkb.LoginState, ctx *Context) error {
		after := func(lctx libkb.LoginContext) error {
			return eng.postLogin(ctx, lctx)
		}
		return loginState.LoginWithPrompt(username, ctx.LoginUI, ctx.SecretUI, after)
	}
	return eng
}

func NewLoginWithPromptEngineSkipLocksmith(username string, gc *libkb.GlobalContext) *LoginEngine {
	eng := NewLoginWithPromptEngine(username, gc)
	eng.SkipLocksmith = true
	return eng
}

func NewLoginWithStoredSecretEngine(username string, gc *libkb.GlobalContext) *LoginEngine {
	eng := &LoginEngine{Contextified: libkb.NewContextified(gc)}
	eng.runFn = func(loginState *libkb.LoginState, ctx *Context) error {
		after := func(lctx libkb.LoginContext) error {
			return eng.postLogin(ctx, lctx)
		}
		return loginState.LoginWithStoredSecret(username, after)
	}

	return eng
}

func NewLoginWithPassphraseEngine(username, passphrase string, storeSecret bool, gc *libkb.GlobalContext) *LoginEngine {
	eng := &LoginEngine{Contextified: libkb.NewContextified(gc)}
	eng.runFn = func(loginState *libkb.LoginState, ctx *Context) error {
		after := func(lctx libkb.LoginContext) error {
			return eng.postLogin(ctx, lctx)
		}
		return loginState.LoginWithPassphrase(username, passphrase, storeSecret, after)
	}

	return eng
}

func (e *LoginEngine) Name() string {
	return "Login"
}

func (e *LoginEngine) Prereqs() Prereqs { return Prereqs{} }

func (e *LoginEngine) RequiredUIs() []libkb.UIKind {
	return e.requiredUIs
}

func (e *LoginEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&Locksmith{},
	}
}

func (e *LoginEngine) Run(ctx *Context) error {
	return e.runFn(e.G().LoginState(), ctx)
}

func (e *LoginEngine) postLogin(ctx *Context, lctx libkb.LoginContext) error {
	// We might need to ID ourselves, so load us in here
	var err error
	e.user, err = libkb.LoadMe(libkb.LoadUserArg{ForceReload: true, LoginContext: lctx})
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
	ctx.LoginContext = lctx
	larg := &LocksmithArg{
		User: e.user,
	}
	e.locksmith = NewLocksmith(larg, e.G())
	err = e.locksmith.LoginCheckup(ctx, e.user)
	if err != nil {
		return err
	}

	lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID().String())

	return nil

}

func (e *LoginEngine) User() *libkb.User {
	return e.user
}

func (e *LoginEngine) Cancel() error {
	e.locksmithMu.Lock()
	defer e.locksmithMu.Unlock()
	if e.locksmith == nil {
		return nil
	}

	return e.locksmith.Cancel()
}

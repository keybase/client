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
	arg := libkb.NewLoadUserForceArg(e.G())
	arg.LoginContext = lctx
	e.user, err = libkb.LoadMe(arg)
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
		User:      e.user,
		CheckOnly: true,
	}
	e.locksmith = NewLocksmith(larg, e.G())
	if err := RunEngine(e.locksmith, ctx); err != nil {
		return err
	}
	if e.locksmith.Status().CurrentDeviceOk {
		if err := lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID()); err != nil {
			// not a fatal error, session will stay in memory
			e.G().Log.Warning("error saving session file: %s", err)
		}
		return nil
	}

	// need to provision this device

	// need to have passphrase stream cached in order to provision a device
	if lctx.PassphraseStreamCache() == nil {
		// this can happen if:
		// 1. The user is logging in for the first time on a device.
		// 2. Before the device is provisioned, the login is canceled or
		//    interrupted.
		// 3. The daemon restarts (`ctl stop`, machine reboot, bug, etc.)
		// 4. The login session is still valid, so the next login attempt
		//    does not require passphrase.
		//
		// (Note that pubkey login isn't an option until the device is
		// provisioned.)
		//
		// 5. So they get to here without entering their passphrase
		//    and without a cached passphrase stream.
		//    Locksmith won't be able to provision the device without
		//    the passphrase stream, and we can't do
		//    LoginState.verifyPassphraseWithServer since that creates
		//    a new login request and we are in the middle of a login
		//    request.
		//
		// The best we can do here is to logout and tell the user to
		// login again.  This should be a rare scenario.
		//
		lctx.Logout()
		ctx.LogUI.Info("Please run `keybase login` again.  There was an unexpected error since your previous login.")
		return libkb.ReloginRequiredError{}
	}

	larg.CheckOnly = false
	e.locksmith = NewLocksmith(larg, e.G())
	if err := RunEngine(e.locksmith, ctx); err != nil {
		if _, canceled := err.(libkb.CanceledError); canceled {
			lctx.Logout()
		}
		return err
	}

	if err := lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID()); err != nil {
		// not a fatal error, session will stay in memory
		e.G().Log.Warning("error saving session file: %s", err)
	}
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

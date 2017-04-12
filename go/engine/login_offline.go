package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
)

type LoginOffline struct {
	libkb.Contextified
}

func NewLoginOffline(g *libkb.GlobalContext) *LoginOffline {
	return &LoginOffline{
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *LoginOffline) Name() string {
	return "LoginOffline"
}

// Prereqs returns the engine prereqs.
func (e *LoginOffline) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginOffline) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginOffline) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *LoginOffline) Run(ctx *Context) error {
	if err := e.run(ctx); err != nil {
		return err
	}

	e.G().Log.Debug("LoginOffline success, sending login notification")
	e.G().NotifyRouter.HandleLogin(string(e.G().Env.GetUsername()))
	e.G().Log.Debug("LoginOffline success, calling login hooks")
	e.G().CallLoginHooks()

	return nil
}

func (e *LoginOffline) run(ctx *Context) error {
	var gerr error
	aerr := e.G().LoginState().Account(func(a *libkb.Account) {
		var in bool
		in, gerr = a.LoggedInProvisioned()
		if gerr != nil {
			// XXX better error?
			e.G().Log.Debug("LoginOffline: LoggedInProvisioned error: %s", gerr)
			return
		}
		if !in {
			// XXX better error?
			e.G().Log.Debug("LoginOffline: LoggedInProvisioned says not logged in")
			gerr = libkb.LoginRequiredError{}
			return
		}

		// current user has a valid session file

		// check ActiveDevice cache
		uid, deviceID, sigKey, encKey := e.G().ActiveDevice.AllFields()
		if sigKey != nil && encKey != nil {
			if uid.Equal(a.GetUID()) && deviceID.Eq(a.GetDeviceID()) {
				// since they match, good to go
				return
			}
		}

		// nothing cached, so need to load the locked keys and unlock them
		// with secret store

		// need ComputedKeyFamily for user in order to find keys
		user, err := libkb.LoadUserFromLocalStorage(ctx.NetContext, e.G(), a.GetUID())
		if err != nil {
			gerr = err
			return
		}
		if user == nil {
			err = errors.New("no user found in local storage")
			// panic("a")
			gerr = err
			return
		}
		partialCopy := user.PartialCopy()

		secretStore := libkb.NewSecretStore(e.G(), partialCopy.GetNormalizedName())

		ska := libkb.SecretKeyArg{
			Me:      partialCopy,
			KeyType: libkb.DeviceSigningKeyType,
		}
		skb, err := a.LockedLocalSecretKey(ska)
		if err != nil {
			gerr = err
			return
		}
		sigKey, err = skb.UnlockNoPrompt(a, secretStore)
		if err != nil {
			gerr = err
			return
		}
		if err = a.SetCachedSecretKey(ska, sigKey); err != nil {
			gerr = err
			return
		}

		ska = libkb.SecretKeyArg{
			Me:      partialCopy,
			KeyType: libkb.DeviceEncryptionKeyType,
		}
		skb, err = a.LockedLocalSecretKey(ska)
		if err != nil {
			gerr = err
			return
		}
		encKey, err = skb.UnlockNoPrompt(a, secretStore)
		if err != nil {
			gerr = err
			return
		}
		if err = a.SetCachedSecretKey(ska, encKey); err != nil {
			gerr = err
			return
		}

	}, "LoginOffline")

	if aerr != nil {
		return aerr
	}
	if gerr != nil {
		return gerr
	}

	return nil
}

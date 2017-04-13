package engine

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
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
	if err := e.run2(ctx); err != nil {
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

func (e *LoginOffline) run2(ctx *Context) error {
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

		uid = e.G().Env.GetUID()
		deviceID = e.G().Env.GetDeviceIDForUID(uid)

		// use the UPAKLoader with StaleOK in order to get cached upak
		arg := libkb.NewLoadUserByUIDArg(ctx.NetContext, e.G(), uid)
		arg.PublicKeyOptional = true
		arg.StaleOK = true
		arg.LoginContext = a
		upak, _, err := e.G().GetUPAKLoader().Load(arg)
		if err != nil {
			e.G().Log.Warning("upak.Load err: %s", err)
			gerr = err
			return
		}

		// find the sibkey
		var sibkey *keybase1.PublicKey
		for _, key := range upak.Base.DeviceKeys {
			e.G().Log.Warning("device key: %+v", key)
			if key.DeviceID.Eq(deviceID) && key.IsSibkey == true {
				e.G().Log.Warning("device key match: %+v", key)
				sibkey = &key
				break
			}
		}
		if sibkey == nil {
			gerr = errors.New("no sibkey found")
			return
		}

		// find the subkey
		var subkey *keybase1.PublicKey
		for _, key := range upak.Base.DeviceKeys {
			if !key.IsSibkey && key.ParentID == sibkey.KID.String() {
				subkey = &key
				break
			}
		}
		if subkey == nil {
			gerr = errors.New("no subkey found")
			return
		}

		// load the keyring file
		username := libkb.NewNormalizedUsername(upak.Base.Username)
		kr, err := libkb.LoadSKBKeyring(username, e.G())
		if err != nil {
			gerr = err
			return
		}

		// get the locked keys out of the keyring
		lockedSibkey := kr.LookupByKid(sibkey.KID)
		if lockedSibkey == nil {
			gerr = errors.New("no locked sibkey found in keyring")
		}
		lockedSibkey.SetUID(uid)

		lockedSubkey := kr.LookupByKid(subkey.KID)
		if lockedSubkey == nil {
			gerr = errors.New("no locked subkey found in keyring")
		}
		lockedSubkey.SetUID(uid)

		// unlock the keys with the secret store
		secretStore := libkb.NewSecretStore(e.G(), username)
		unlockedSibkey, err := lockedSibkey.UnlockNoPrompt(a, secretStore)
		if err != nil {
			gerr = err
			return
		}

		unlockedSubkey, err := lockedSubkey.UnlockNoPrompt(a, secretStore)
		if err != nil {
			gerr = err
			return
		}

		// cache the unlocked secret keys
		ska := libkb.SecretKeyArg{KeyType: libkb.DeviceSigningKeyType}
		if err := a.SetCachedSecretKey(ska, unlockedSibkey); err != nil {
			gerr = err
			return
		}
		ska = libkb.SecretKeyArg{KeyType: libkb.DeviceEncryptionKeyType}
		if err := a.SetCachedSecretKey(ska, unlockedSubkey); err != nil {
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

package engine

import (
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
			e.G().Log.Debug("LoginOffline: LoggedInProvisioned error: %s", gerr)
			return
		}
		if !in {
			e.G().Log.Debug("LoginOffline: LoggedInProvisioned says not logged in")
			gerr = libkb.LoginRequiredError{}
			return
		}

		// current user has a valid session file
		e.G().Log.Debug("LoginOffline: current user has a valid session file")

		// check ActiveDevice cache
		uid, deviceID, sigKey, encKey := e.G().ActiveDevice.AllFields()
		if sigKey != nil && encKey != nil {
			if uid.Equal(a.GetUID()) && deviceID.Eq(a.GetDeviceID()) {
				// since they match, good to go
				e.G().Log.Debug("LoginOffline: found cached device keys in ActiveDevice")
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
			e.G().Log.Debug("LoginOffline: upak.Load err: %s", err)
			gerr = err
			return
		}

		// find the sibkey
		var sibkey *keybase1.PublicKey
		for _, key := range upak.Base.DeviceKeys {
			if key.DeviceID.Eq(deviceID) && key.IsSibkey == true {
				e.G().Log.Debug("LoginOffline: device sibkey match: %+v", key)
				sibkey = &key
				break
			}
		}
		if sibkey == nil {
			e.G().Log.Debug("LoginOffline: no sibkey found in upak.Base.DeviceKeys")
			gerr = libkb.NewLoginOfflineError("no sibkey found")
			return
		}

		// find the subkey
		var subkey *keybase1.PublicKey
		for _, key := range upak.Base.DeviceKeys {
			if !key.IsSibkey && key.ParentID == sibkey.KID.String() {
				e.G().Log.Debug("LoginOffline: subkey match: %+v", key)
				subkey = &key
				break
			}
		}
		if subkey == nil {
			e.G().Log.Debug("LoginOffline: no subkey found in upak.Base.DeviceKeys")
			gerr = libkb.NewLoginOfflineError("no subkey found")
			return
		}

		// load the keyring file
		username := libkb.NewNormalizedUsername(upak.Base.Username)
		kr, err := libkb.LoadSKBKeyring(username, e.G())
		if err != nil {
			e.G().Log.Debug("LoginOffline: error loading keyring for %s: %s", username, err)
			gerr = err
			return
		}

		// get the locked keys out of the keyring
		lockedSibkey := kr.LookupByKid(sibkey.KID)
		if lockedSibkey == nil {
			e.G().Log.Debug("LoginOffline: no locked sibkey with KID %s", sibkey.KID)
			gerr = libkb.NewLoginOfflineError("no locked sibkey found in keyring")
			return
		}
		lockedSibkey.SetUID(uid)

		lockedSubkey := kr.LookupByKid(subkey.KID)
		if lockedSubkey == nil {
			e.G().Log.Debug("LoginOffline: no locked subkey with KID %s", subkey.KID)
			gerr = libkb.NewLoginOfflineError("no locked subkey found in keyring")
			return
		}
		lockedSubkey.SetUID(uid)

		// unlock the keys with the secret store
		secretStore := libkb.NewSecretStore(e.G(), username)
		unlockedSibkey, err := lockedSibkey.UnlockNoPrompt(a, secretStore)
		if err != nil {
			e.G().Log.Debug("LoginOffline: failed to unlock sibkey: %s", err)
			gerr = err
			return
		}

		unlockedSubkey, err := lockedSubkey.UnlockNoPrompt(a, secretStore)
		if err != nil {
			e.G().Log.Debug("LoginOffline: failed to unlock subkey: %s", err)
			gerr = err
			return
		}

		device := &libkb.Device{
			ID:          deviceID,
			Kid:         sibkey.KID,
			Description: &sibkey.DeviceDescription,
		}

		// cache the unlocked secret keys
		ska := libkb.SecretKeyArg{KeyType: libkb.DeviceSigningKeyType}
		if err := a.SetCachedSecretKey(ska, unlockedSibkey, device); err != nil {
			e.G().Log.Debug("LoginOffline: failed to cache sibkey: %s", err)
			gerr = err
			return
		}
		ska = libkb.SecretKeyArg{KeyType: libkb.DeviceEncryptionKeyType}
		if err := a.SetCachedSecretKey(ska, unlockedSubkey, device); err != nil {
			e.G().Log.Debug("LoginOffline: failed to cache subkey: %s", err)
			gerr = err
			return
		}
	}, "LoginOffline")

	if aerr != nil {
		e.G().Log.Debug("LoginOffline: LoginState account error: %s", aerr)
		return aerr
	}
	if gerr != nil {
		return gerr
	}

	e.G().Log.Debug("LoginOffline: run success")

	return nil
}

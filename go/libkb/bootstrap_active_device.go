package libkb

import (
	"fmt"
	"github.com/keybase/client/go/protocol/keybase1"
)

func loadAndUnlockKey(m MetaContext, kr *SKBKeyringFile, secretStore SecretStore, uid keybase1.UID, kid keybase1.KID) (key GenericKey, err error) {
	defer m.CTrace(fmt.Sprintf("loadAndUnlockKey(%s)", kid), func() error { return err })()

	locked := kr.LookupByKid(kid)
	if locked == nil {
		m.CDebugf("loadAndUnlockKey: no locked key for %s", kid)
		return nil, NoKeyError{fmt.Sprintf("no key for %s", kid)}
	}
	locked.SetUID(uid)
	unlocked, err := locked.UnlockNoPrompt(m, secretStore)
	if err != nil {
		m.CDebugf("Failed to unlock key %s: %s", kid, err)
		return nil, err
	}
	return unlocked, err
}

func BootstrapActiveDeviceFromConfig(m MetaContext, online bool) (uid keybase1.UID, err error) {
	uid, err = bootstrapActiveDeviceFromConfigReturnRawError(m, online)
	err = fixupBootstrapError(err)
	return uid, err
}

func bootstrapActiveDeviceFromConfigReturnRawError(m MetaContext, online bool) (uid keybase1.UID, err error) {
	uid = m.G().Env.GetUID()
	if uid.IsNil() {
		return uid, NoUIDError{}
	}
	deviceID := m.G().Env.GetDeviceIDForUID(uid)
	if deviceID.IsNil() {
		return uid, NoDeviceError{fmt.Sprintf("no device in config for UID=%s", uid)}
	}
	err = BootstrapActiveDevice(m, uid, deviceID, online)
	return uid, err
}

func isBootstrapLoggedOutError(err error) bool {
	if _, ok := err.(NoUIDError); ok {
		return true
	}
	if err == ErrUnlockNotPossible {
		return true
	}
	return false
}

func fixupBootstrapError(err error) error {
	if err == nil {
		return nil
	}
	if isBootstrapLoggedOutError(err) {
		return LoginRequiredError{err.Error()}
	}
	return err
}

// BootstrapActiveDevice takes the user's config.json, keys.mpack file and
// secret store to populate ActiveDevice, and to have all credentials necessary
// to sign NIST tokens, allowing the user to act as if "logged in". Will return
// nil if everything work, LoginRequiredError if a real "login" in required to
// make the app work, and various errors on unexpected failures.
func BootstrapActiveDevice(m MetaContext, uid keybase1.UID, deviceID keybase1.DeviceID, online bool) error {
	err := bootstrapActiveDeviceReturnRawError(m, uid, deviceID, online)
	return fixupBootstrapError(err)
}

func bootstrapActiveDeviceReturnRawError(m MetaContext, uid keybase1.UID, deviceID keybase1.DeviceID, online bool) (err error) {
	defer m.CTrace("BootstrapActiveDevice", func() error { return err })()

	ad := m.ActiveDevice()

	if ad.IsValidFor(uid, deviceID) {
		m.CDebugf("active device is current")
		return nil
	}
	// use the UPAKLoader with StaleOK, CachedOnly in order to get cached upak
	arg := NewLoadUserArgWithMetaContext(m).WithUID(uid).WithPublicKeyOptional()
	if !online {
		arg = arg.WithStaleOK(true).WithCachedOnly()
	}
	upak, _, err := m.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		m.CDebugf("BootstrapActiveDevice: upak.Load err: %s", err)
		return err
	}

	if upak.Current.Status == keybase1.StatusCode_SCDeleted {
		m.CDebugf("User %s was deleted", uid)
		return UserDeletedError{}
	}

	// find the sibkey
	sibkeyKID, deviceName := upak.Current.FindSigningDeviceKID(deviceID)
	if sibkeyKID.IsNil() {
		m.CDebugf("BootstrapActiveDevice: no sibkey found for device %s", deviceID)
		return NoKeyError{"no signing device key found for user"}
	}

	subkeyKID := upak.Current.FindEncryptionDeviceKID(sibkeyKID)
	if subkeyKID.IsNil() {
		m.CDebugf("BootstrapActiveDevice: no subkey found for device: %s", deviceID)
		return NoKeyError{"no encryption device key found for user"}
	}

	// load the keyring file
	username := NewNormalizedUsername(upak.Current.Username)
	kr, err := LoadSKBKeyring(username, m.G())
	if err != nil {
		m.CDebugf("BootstrapActiveDevice: error loading keyring for %s: %s", username, err)
		return err
	}

	secretStore := NewSecretStore(m.G(), username)
	sib, err := loadAndUnlockKey(m, kr, secretStore, uid, sibkeyKID)
	if err != nil {
		return err
	}
	sub, err := loadAndUnlockKey(m, kr, secretStore, uid, subkeyKID)
	if err != nil {
		return err
	}

	err = ad.Set(m, uid, deviceID, sib, sub, deviceName)
	return err
}

// BootstrapActiveDeviceWithLoginConext will setup an ActiveDevice with a NIST Factory
// for the caller. The m.loginContext passed through isn't really needed
// for anything aside from assertions, but as we phase out LoginState, we'll
// leave it here so that assertions in LoginState can still pass.
func BootstrapActiveDeviceWithMetaContext(m MetaContext) (ok bool, uid keybase1.UID, err error) {
	run := func(lctx LoginContext) (keybase1.UID, error) {
		return BootstrapActiveDeviceFromConfig(m.WithLoginContext(lctx), true)
	}
	if lctx := m.LoginContext(); lctx == nil {
		aerr := m.G().LoginState().Account(func(lctx *Account) {
			uid, err = run(lctx)
		}, "BootstrapActiveDevice")
		if err == nil && aerr != nil {
			m.CDebugf("LoginOffline: LoginState account error: %s", aerr)
			err = aerr
		}
	} else {
		uid, err = run(lctx)
	}
	ok = false
	if err == nil {
		ok = true
	} else if _, isLRE := err.(LoginRequiredError); isLRE {
		err = nil
	}
	return ok, uid, err
}

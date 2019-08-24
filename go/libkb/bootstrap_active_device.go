package libkb

import (
	"fmt"

	"github.com/keybase/client/go/protocol/keybase1"
)

func loadAndUnlockKey(m MetaContext, kr *SKBKeyringFile, secretStore SecretStore, uid keybase1.UID, kid keybase1.KID) (key GenericKey, err error) {
	defer m.Trace(fmt.Sprintf("loadAndUnlockKey(%s)", kid), func() error { return err })()

	locked := kr.LookupByKid(kid)
	if locked == nil {
		m.Debug("loadAndUnlockKey: no locked key for %s", kid)
		return nil, NoKeyError{fmt.Sprintf("no key for %s", kid)}
	}
	locked.SetUID(uid)
	unlocked, err := locked.UnlockNoPrompt(m, secretStore)
	if err != nil {
		m.Debug("Failed to unlock key %s: %s", kid, err)
		return nil, err
	}
	return unlocked, err
}

// BootstrapActiveDeviceFromConfig takes the user's config.json, keys.mpack file and
// secret store to populate ActiveDevice, and to have all credentials necessary
// to sign NIST tokens, allowing the user to act as if "logged in". Will return
// nil if everything work, LoginRequiredError if a real "login" is required to
// make the app work, and various errors on unexpected failures.
func BootstrapActiveDeviceFromConfig(m MetaContext, online bool) (uid keybase1.UID, err error) {
	uid, err = bootstrapActiveDeviceFromConfigReturnRawError(m, online, keybase1.UID(""))
	err = fixupBootstrapError(err)
	return uid, err
}

func bootstrapActiveDeviceFromConfigReturnRawError(m MetaContext, online bool, assertUID keybase1.UID) (uid keybase1.UID, err error) {
	uid = m.G().Env.GetUID()
	if uid.IsNil() {
		return uid, NoUIDError{}
	}
	if assertUID.Exists() && !assertUID.Equal(uid) {
		return uid, NewUIDMismatchError(fmt.Sprintf("wanted %s but got %s", assertUID, uid))
	}
	deviceID := m.G().Env.GetDeviceIDForUID(uid)
	if deviceID.IsNil() {
		return uid, NoDeviceError{fmt.Sprintf("no device in config for UID=%s", uid)}
	}
	err = bootstrapActiveDeviceReturnRawError(m, uid, deviceID, online)
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

func bootstrapActiveDeviceReturnRawError(m MetaContext, uid keybase1.UID, deviceID keybase1.DeviceID, online bool) (err error) {
	defer m.Trace(fmt.Sprintf("bootstrapActiveDeviceReturnRaw(%s,%s)", uid, deviceID), func() error { return err })()

	ad := m.ActiveDevice()
	if ad.IsValidFor(uid, deviceID) {
		m.Debug("active device is current")
		return nil
	}
	uv, sib, sub, deviceName, err := LoadUnlockedDeviceKeys(m, uid, deviceID, online)
	if err != nil {
		return err
	}
	err = m.SetActiveDevice(uv, deviceID, sib, sub, deviceName)
	return err
}

func LoadUnlockedDeviceKeys(m MetaContext, uid keybase1.UID, deviceID keybase1.DeviceID, online bool) (uv keybase1.UserVersion, sib GenericKey, sub GenericKey, deviceName string, err error) {
	defer m.Trace("LoadUnlockedDeviceKeys", func() error { return err })()

	// use the UPAKLoader with StaleOK, CachedOnly in order to get cached upak
	arg := NewLoadUserArgWithMetaContext(m).WithUID(uid).WithPublicKeyOptional()
	if !online {
		arg = arg.WithStaleOK(true).WithCachedOnly()
	}
	upak, _, err := m.G().GetUPAKLoader().LoadV2(arg)
	if err != nil {
		m.Debug("BootstrapActiveDevice: upak.Load err: %s", err)
		return uv, nil, nil, deviceName, err
	}

	if upak.Current.Status == keybase1.StatusCode_SCDeleted {
		m.Debug("User %s was deleted", uid)
		return uv, nil, nil, deviceName, UserDeletedError{}
	}

	device := upak.Current.FindSigningDeviceKey(deviceID)
	if device == nil {
		m.Debug("BootstrapActiveDevice: no sibkey found for device %s", deviceID)
		return uv, nil, nil, deviceName, NoKeyError{"no signing device key found for user"}
	}

	if device.Base.Revocation != nil {
		m.Debug("BootstrapActiveDevice: device %s was revoked", deviceID)
		return uv, nil, nil, deviceName, NewKeyRevokedError("active device")
	}

	sibkeyKID := device.Base.Kid
	deviceName = device.DeviceDescription

	subkeyKID := upak.Current.FindEncryptionKIDFromSigningKID(sibkeyKID)
	if subkeyKID.IsNil() {
		m.Debug("BootstrapActiveDevice: no subkey found for device: %s", deviceID)
		return uv, nil, nil, deviceName, NoKeyError{"no encryption device key found for user"}
	}

	// load the keyring file
	username := NewNormalizedUsername(upak.Current.Username)
	kr, err := LoadSKBKeyring(username, m.G())
	if err != nil {
		m.Debug("BootstrapActiveDevice: error loading keyring for %s: %s", username, err)
		return uv, nil, nil, deviceName, err
	}

	secretStore := NewSecretStore(m.G(), username)
	sib, err = loadAndUnlockKey(m, kr, secretStore, uid, sibkeyKID)
	if err != nil {
		return uv, nil, nil, deviceName, err
	}
	sub, err = loadAndUnlockKey(m, kr, secretStore, uid, subkeyKID)
	if err != nil {
		return uv, nil, nil, deviceName, err
	}

	return upak.Current.ToUserVersion(), sib, sub, deviceName, nil
}

func LoadProvisionalActiveDevice(m MetaContext, uid keybase1.UID, deviceID keybase1.DeviceID, online bool) (ret *ActiveDevice, err error) {
	defer m.Trace("LoadProvisionalActiveDevice", func() error { return err })()
	uv, sib, sub, deviceName, err := LoadUnlockedDeviceKeys(m, uid, deviceID, online)
	if err != nil {
		return nil, err
	}
	ret = NewProvisionalActiveDevice(m, uv, deviceID, sib, sub, deviceName)
	return ret, nil
}

// BootstrapActiveDeviceWithMetaContext will setup an ActiveDevice with a NIST Factory
// for the caller. The m.loginContext passed through isn't really needed
// for anything aside from assertions, but as we phase out LoginState, we'll
// leave it here so that assertions in LoginState can still pass.
func BootstrapActiveDeviceWithMetaContext(m MetaContext) (ok bool, uid keybase1.UID, err error) {
	uid, err = BootstrapActiveDeviceFromConfig(m, true)
	ok = false
	if err == nil {
		ok = true
	} else if _, isLRE := err.(LoginRequiredError); isLRE {
		err = nil
	}
	return ok, uid, err
}

// BootstrapActiveDeviceWithMetaContextAndAssertUID will setup an ActiveDevice with a NIST Factory
// for the caller. It only works if we're logged in as the given UID
func BootstrapActiveDeviceWithMetaContextAndAssertUID(m MetaContext, uid keybase1.UID) (ok bool, err error) {
	_, err = bootstrapActiveDeviceFromConfigReturnRawError(m, true, uid)
	switch err.(type) {
	case nil:
		return true, nil
	case LoginRequiredError:
		return false, nil
	case UIDMismatchError:
		return false, nil
	case NoUIDError:
		return false, nil
	default:
		if err == ErrUnlockNotPossible {
			return false, nil
		}
		return false, err
	}
}

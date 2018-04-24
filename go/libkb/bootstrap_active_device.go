package libkb

import (
	"fmt"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

func loadAndUnlockKey(ctx context.Context, g *GlobalContext, lctx LoginContext, kr *SKBKeyringFile, secretStore SecretStore, uid keybase1.UID, kid keybase1.KID) (key GenericKey, err error) {
	defer g.CTrace(ctx, fmt.Sprintf("loadAndUnlockKey(%s)", kid), func() error { return err })()

	locked := kr.LookupByKid(kid)
	if locked == nil {
		g.Log.CDebugf(ctx, "loadAndUnlockKey: no locked key for %s", kid)
		return nil, NoKeyError{fmt.Sprintf("no key for %s", kid)}
	}
	locked.SetUID(uid)
	unlocked, err := locked.UnlockNoPrompt(lctx, secretStore)
	if err != nil {
		g.Log.CDebugf(ctx, "Failed to unlock key %s: %s", kid, err)
		return nil, err
	}
	return unlocked, err
}

func BootstrapActiveDeviceFromConfig(ctx context.Context, g *GlobalContext, lctx LoginContext, online bool) (uid keybase1.UID, err error) {
	uid, err = bootstrapActiveDeviceFromConfigReturnRawError(ctx, g, lctx, online)
	err = fixupBootstrapError(err)
	return uid, err
}

func bootstrapActiveDeviceFromConfigReturnRawError(ctx context.Context, g *GlobalContext, lctx LoginContext, online bool) (uid keybase1.UID, err error) {
	uid = g.Env.GetUID()
	if uid.IsNil() {
		return uid, NoUIDError{}
	}
	deviceID := g.Env.GetDeviceIDForUID(uid)
	if deviceID.IsNil() {
		return uid, NoDeviceError{fmt.Sprintf("no device in config for UID=%s", uid)}
	}
	err = BootstrapActiveDevice(ctx, g, lctx, uid, deviceID, online)
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
func BootstrapActiveDevice(ctx context.Context, g *GlobalContext, lctx LoginContext, uid keybase1.UID, deviceID keybase1.DeviceID, online bool) error {
	err := bootstrapActiveDeviceReturnRawError(ctx, g, lctx, uid, deviceID, online)
	return fixupBootstrapError(err)
}

func bootstrapActiveDeviceReturnRawError(ctx context.Context, g *GlobalContext, lctx LoginContext, uid keybase1.UID, deviceID keybase1.DeviceID, online bool) (err error) {
	defer g.CTrace(ctx, "BootstrapActiveDevice", func() error { return err })()

	ad := g.ActiveDevice

	if ad.IsValidFor(uid, deviceID) {
		g.Log.CDebugf(ctx, "active device is current")
		return nil
	}
	// use the UPAKLoader with StaleOK, CachedOnly in order to get cached upak
	arg := NewLoadUserByUIDArg(ctx, g, uid).WithPublicKeyOptional()
	if !online {
		arg = arg.WithStaleOK(true).WithCachedOnly()
	}
	if lctx != nil {
		arg = arg.WithLoginContext(lctx)
	}
	upak, _, err := g.GetUPAKLoader().LoadV2(arg)
	if err != nil {
		g.Log.CDebugf(ctx, "BootstrapActiveDevice: upak.Load err: %s", err)
		return err
	}

	if upak.Current.Status == keybase1.StatusCode_SCDeleted {
		g.Log.CDebugf(ctx, "User %s was deleted", uid)
		return UserDeletedError{}
	}

	// find the sibkey
	sibkeyKID, deviceName := upak.Current.FindSigningDeviceKID(deviceID)
	if sibkeyKID.IsNil() {
		g.Log.CDebugf(ctx, "BootstrapActiveDevice: no sibkey found for device %s", deviceID)
		return NoKeyError{"no signing device key found for user"}
	}

	subkeyKID := upak.Current.FindEncryptionDeviceKID(sibkeyKID)
	if subkeyKID.IsNil() {
		g.Log.CDebugf(ctx, "BootstrapActiveDevice: no subkey found for device: %s", deviceID)
		return NoKeyError{"no encryption device key found for user"}
	}

	// load the keyring file
	username := NewNormalizedUsername(upak.Current.Username)
	kr, err := LoadSKBKeyring(username, g)
	if err != nil {
		g.Log.CDebugf(ctx, "BootstrapActiveDevice: error loading keyring for %s: %s", username, err)
		return err
	}

	secretStore := NewSecretStore(g, username)
	sib, err := loadAndUnlockKey(ctx, g, lctx, kr, secretStore, uid, sibkeyKID)
	if err != nil {
		return err
	}
	sub, err := loadAndUnlockKey(ctx, g, lctx, kr, secretStore, uid, subkeyKID)
	if err != nil {
		return err
	}

	err = ad.Set(g, lctx, uid, deviceID, sib, sub, deviceName)
	return err
}

// BootstrapActiveDeviceWithLoginConext will setup an ActiveDevice with a NIST Factory
// for the caller. The LoginContext passed through isn't really needed
// for anything aside from assertions, but as we phase out LoginState, we'll
// leave it here so that assertions in LoginState can still pass.
func BootstrapActiveDeviceWithLoginContext(ctx context.Context, g *GlobalContext, lctx LoginContext) (ok bool, uid keybase1.UID, err error) {
	run := func(lctx LoginContext) (keybase1.UID, error) {
		return BootstrapActiveDeviceFromConfig(ctx, g, lctx, true)
	}
	if lctx == nil {
		aerr := g.LoginState().Account(func(lctx *Account) {
			uid, err = run(lctx)
		}, "BootstrapActiveDevice")
		if err == nil && aerr != nil {
			g.Log.CDebugf(ctx, "LoginOffline: LoginState account error: %s", aerr)
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

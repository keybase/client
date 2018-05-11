// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// LoginProvisionedDevice is an engine that tries to login using the
// current device, if there is an existing provisioned device.
type LoginProvisionedDevice struct {
	libkb.Contextified
	username        libkb.NormalizedUsername
	uid             keybase1.UID
	deviceID        keybase1.DeviceID
	SecretStoreOnly bool // this should only be set by the service on its startup login attempt
}

// newLoginCurrentDevice creates a loginProvisionedDevice engine.
func NewLoginProvisionedDevice(g *libkb.GlobalContext, username string) *LoginProvisionedDevice {
	return &LoginProvisionedDevice{
		username:     libkb.NewNormalizedUsername(username),
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *LoginProvisionedDevice) Name() string {
	return "LoginProvisionedDevice"
}

// GetPrereqs returns the engine prereqs.
func (e *LoginProvisionedDevice) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginProvisionedDevice) RequiredUIs() []libkb.UIKind {
	if e.SecretStoreOnly {
		return []libkb.UIKind{}
	}

	return []libkb.UIKind{
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginProvisionedDevice) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *LoginProvisionedDevice) Run(m libkb.MetaContext) error {
	if err := e.run(m); err != nil {
		return err
	}

	m.CDebugf("LoginProvisionedDevice success, sending login notification")
	m.G().NotifyRouter.HandleLogin(e.username.String())
	m.CDebugf("LoginProvisionedDevice success, calling login hooks")
	m.G().CallLoginHooks()

	return nil
}

func (e *LoginProvisionedDevice) loadMe(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginProvisionedDevice#loadMe", func() error { return err })()

	var config *libkb.UserConfig
	var nu libkb.NormalizedUsername
	loadUserArg := libkb.NewLoadUserArgWithMetaContext(m).WithPublicKeyOptional().WithForcePoll(true)
	if len(e.username) == 0 {
		m.CDebugf("| using current username")
		config, err = m.G().Env.GetConfig().GetUserConfig()
		if config == nil {
			m.CDebugf("user config is nil")
			return errNoConfig
		}
		loadUserArg = loadUserArg.WithSelf(true).WithUID(config.GetUID())
	} else {
		m.CDebugf("| using new username %s", e.username)
		nu = e.username
		config, err = m.G().Env.GetConfig().GetUserConfigForUsername(nu)
		loadUserArg = loadUserArg.WithName(e.username.String())
		if config == nil {
			m.CDebugf("user config is nil for %s", e.username)
			return errNoConfig
		}
	}
	if err != nil {
		m.CDebugf("error getting user config: %s (%T)", err, err)
		return errNoConfig
	}
	deviceID := config.GetDeviceID()
	if deviceID.IsNil() {
		m.CDebugf("no device in user config")
		return errNoDevice
	}

	// Make sure the device ID is still valid.
	upak, _, err := m.G().GetUPAKLoader().LoadV2(loadUserArg)
	if err != nil {
		m.CDebugf("error loading user profile: %#v", err)
		return err
	}
	if upak.Current.Status == keybase1.StatusCode_SCDeleted {
		m.CDebugf("User %s was deleted", upak.Current.Uid)
		return libkb.UserDeletedError{}
	}

	nu = libkb.NewNormalizedUsername(upak.Current.Username)
	device := upak.Current.FindSigningDeviceKey(deviceID)

	nukeDevice := false
	if device == nil {
		m.CDebugf("Current device %s not found", deviceID)
		nukeDevice = true
	} else if device.Base.Revocation != nil {
		m.CDebugf("Current device %s has been revoked", deviceID)
		nukeDevice = true
	}

	if nukeDevice {
		// If our config file is showing that we have a bogus
		// deviceID (maybe from our account before an account reset),
		// then we'll delete it from the config file here, so later parts
		// of provisioning aren't confused by this device ID.
		tmp := m.SwitchUserNukeConfig(nu)
		if tmp != nil {
			m.CWarningf("Error clearing user config: %s", tmp)
		}
		return errNoDevice
	}

	e.username = nu
	e.deviceID = deviceID
	e.uid = upak.Current.Uid
	return nil
}

func (e *LoginProvisionedDevice) reattemptUnlockIfDifferentUID(m libkb.MetaContext, loggedInUID keybase1.UID) (success bool, err error) {
	defer m.CTrace("LoginProvisionedDevice#reattemptUnlockIfDifferentUID", func() error { return err })()
	if loggedInUID.Equal(e.uid) {
		m.CDebugf("no reattempting unlock; already tried for same UID")
		return false, nil
	}
	return e.reattemptUnlock(m)
}

// reattemptUnlock reattempts to unlock the device's device keys. We already tried implicitly
// early on in the run() function via `isLoggedIn`, which calls `Bootstrap...`. We try the whole
// shebang again twice more: once after switching users (if there is indeeed a switch). And again
// after asking the user for a passphrase login.
func (e *LoginProvisionedDevice) reattemptUnlock(m libkb.MetaContext) (success bool, err error) {
	defer m.CTrace("LoginProvisionedDevice#reattemptUnlock", func() error { return err })()
	ad, err := libkb.LoadProvisionalActiveDevice(m, e.uid, e.deviceID, true)
	if err != nil {
		m.CDebugf("Failed to load provisional device for user, but swallowing error: %s", err.Error())
		return false, nil
	}
	if ad == nil {
		m.CDebugf("Unexpected nil active device from LoadProvisionalActiveDevice without error")
		return false, nil
	}
	err = m.SwitchUserToActiveDevice(e.username, ad)
	if err != nil {
		m.CDebugf("Error switching to new active device: %s", err.Error())
		return false, err
	}
	return true, nil
}

// tryPassphraseLogin tries a username/passphrase login to the server, and makes a global
// side effect: to store the user's full LKSec secret into the secret store. After which point,
// usual attempts to run LoadProvisionalActiveDevice or BootstrapActiveDevice will succeed
// without a prompt.
func (e *LoginProvisionedDevice) tryPassphraseLogin(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginProvisionedDevice#tryPassphraseLogin", func() error { return err })()
	err = libkb.PassphraseLoginPrompt(m, e.username.String(), 3)
	if err != nil {
		return err
	}

	// A failure here is just a warning, since we still can use the app for this
	// session. But it will undoubtedly cause pain.
	w := libkb.StoreSecretAfterLogin(m, e.username, e.uid, e.deviceID)
	if w != nil {
		m.CWarningf("Secret store failed: %s", w.Error())
	}

	return nil
}

func (e *LoginProvisionedDevice) runBug3964Repairman(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginProvisionedDevice#runBug3964Repairman", func() error { return err })()
	return libkb.RunBug3964Repairman(m)
}

func (e *LoginProvisionedDevice) run(m libkb.MetaContext) (err error) {
	defer m.CTrace("LoginProvisionedDevice#run", func() error { return err })()

	// already logged in?
	in, loggedInUID := isLoggedIn(m)
	if in && (len(e.username) == 0 || m.G().Env.GetUsernameForUID(loggedInUID).Eq(e.username)) {
		m.CDebugf("user %s already logged in; short-circuting", loggedInUID)
		return nil
	}

	err = e.loadMe(m)
	if err != nil {
		return err
	}

	var success bool
	success, err = e.reattemptUnlockIfDifferentUID(m, loggedInUID)
	if err != nil {
		return err
	}
	if success {
		return nil
	}

	if e.SecretStoreOnly {
		return libkb.NewLoginRequiredError("explicit login is required")
	}

	e.connectivityWarning(m)

	m = m.WithNewProvisionalLoginContext()
	err = e.tryPassphraseLogin(m)
	if err != nil {
		return err
	}

	e.runBug3964Repairman(m)

	success, err = e.reattemptUnlock(m)
	if err != nil {
		return err
	}
	if !success {
		return libkb.NewLoginRequiredError("login failed after passphrase verified")
	}
	return nil
}

func (e *LoginProvisionedDevice) connectivityWarning(m libkb.MetaContext) {

	// CORE-5876 idea that lksec will be unusable if reachability state is NO
	// and the user changed passphrase with a different device since it won't
	// be able to sync the new server half.
	if m.G().ConnectivityMonitor.IsConnected(m.Ctx()) != libkb.ConnectivityMonitorYes {
		m.CDebugf("LoginProvisionedDevice: in unlockDeviceKeys, ConnectivityMonitor says not reachable, check to make sure")
		if err := m.G().ConnectivityMonitor.CheckReachability(m.Ctx()); err != nil {
			m.CDebugf("error checking reachability: %s", err)
		} else {
			connected := m.G().ConnectivityMonitor.IsConnected(m.Ctx())
			m.CDebugf("after CheckReachability(), IsConnected() => %v (connected? %v)", connected, connected == libkb.ConnectivityMonitorYes)
		}
	}
}

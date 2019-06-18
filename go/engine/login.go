// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is the main login engine.

package engine

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

var errNoConfig = errors.New("No user config available")
var errNoDevice = errors.New("No device provisioned locally for this user")

// Login is an engine.
type Login struct {
	libkb.Contextified
	deviceType string
	username   string
	clientType keybase1.ClientType

	doUserSwitch bool

	// Used for non-interactive provisioning
	PaperKey   string
	DeviceName string

	// Used in tests for reproducible key generation
	naclSigningKeyPair    libkb.NaclKeyPair
	naclEncryptionKeyPair libkb.NaclKeyPair

	resetPending bool
}

// NewLogin creates a Login engine.  username is optional.
// deviceType should be libkb.DeviceTypeDesktop or
// libkb.DeviceTypeMobile.
func NewLogin(g *libkb.GlobalContext, deviceType string, username string, ct keybase1.ClientType) *Login {
	return NewLoginWithUserSwitch(g, deviceType, username, ct, false)
}

// NewLoginWithUserSwitch creates a Login engine. username is optional.
// deviceType should be libkb.DeviceTypeDesktop or libkb.DeviceTypeMobile.
// You can also specify a bool to say whether you'd like to doUserSwitch or not.
// By default, this flag is off (see above), but as we roll out user switching,
// we can start to turn this on in more places.
func NewLoginWithUserSwitch(g *libkb.GlobalContext, deviceType string, username string, ct keybase1.ClientType, doUserSwitch bool) *Login {
	return &Login{
		Contextified: libkb.NewContextified(g),
		deviceType:   deviceType,
		username:     strings.TrimSpace(username),
		clientType:   ct,
		doUserSwitch: doUserSwitch,
	}
}

// Name is the unique engine name.
func (e *Login) Name() string {
	return "Login"
}

// GetPrereqs returns the engine prereqs.
func (e *Login) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *Login) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Login) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&LoginProvisionedDevice{},
		&loginLoadUser{},
		&loginProvision{},
		&AccountReset{},
	}
}

// Run starts the engine.
func (e *Login) Run(m libkb.MetaContext) (err error) {
	m = m.WithLogTag("LOGIN")
	defer m.Trace("Login#Run", func() error { return err })()

	if len(e.username) > 0 && libkb.CheckEmail.F(e.username) {
		// We used to support logging in with e-mail but we don't anymore,
		// since 2019-03-20.(CORE-10470).
		return libkb.NewBadUsernameErrorWithFullMessage("Logging in with e-mail address is not supported")
	}

	var currentUsername libkb.NormalizedUsername
	if dev := m.ActiveDevice(); dev != nil {
		currentUsername = m.ActiveDevice().Username(m)
	}

	// check to see if already logged in
	var loggedInOK bool
	loggedInOK, err = e.checkLoggedInAndNotRevoked(m)
	if err != nil {
		m.Debug("Login: error checking if user is logged in: %s", err)
		return err
	}
	if loggedInOK {
		return nil
	}
	m.Debug("Login: not currently logged in")

	if e.doUserSwitch && !currentUsername.IsNil() {
		defer e.restoreSession(m, currentUsername, func() error { return err })
	}

	// First see if this device is already provisioned and it is possible to log in.
	loggedInOK, err = e.loginProvisionedDevice(m, e.username)
	if err != nil {
		m.Debug("loginProvisionedDevice error: %s", err)

		if m.G().Env.GetFeatureFlags().HasFeature(libkb.EnvironmentFeatureAutoresetPipeline) {
			// Suggest autoreset if user failed to log in and we're provisioned
			if _, ok := err.(libkb.PassphraseError); ok {
				return e.suggestRecoveryForgotPassword(m)
			}
		}

		return err
	}
	if loggedInOK {
		m.Debug("loginProvisionedDevice success")
		return nil
	}

	m.Debug("loginProvisionedDevice failed, continuing with device provisioning")

	// clear out any existing session:
	m.Debug("clearing any existing login session with Logout before loading user for login")
	// If the doUserSwitch flag is specified, we don't want to kill the existing session
	m.G().LogoutCurrentUserWithSecretKill(m, !e.doUserSwitch)

	// Set up a provisional login context for the purposes of running provisioning.
	// This is where we'll store temporary session tokens, etc, that are useful
	// in the context of this provisioning session.
	m = m.WithNewProvisionalLoginContext()
	defer func() {
		if err == nil {
			// resets the LoginContext to be nil, and also commits cacheable
			// data like the passphrase stream into the global context.
			m = m.CommitProvisionalLogin()
		}
	}()

	resetPending, err := e.loginProvision(m)
	if err != nil {
		return err
	}
	if resetPending {
		// We've just started a reset process
		e.resetPending = true
		return nil
	}

	e.perUserKeyUpgradeSoft(m)

	m.Debug("Login provisioning success, sending login notification")
	e.sendNotification(m)
	return nil
}

func (e *Login) restoreSession(m libkb.MetaContext, originalUsername libkb.NormalizedUsername, errfn func() error) {
	err := errfn()
	if err == nil {
		return
	}

	loggedInOK, err := e.loginProvisionedDevice(m, originalUsername.String())
	if err != nil {
		m.Debug("Login#restoreSession-loginProvisionedDevice error: %s", err)
		return
	}
	if loggedInOK {
		m.Debug("Login#restoreSession-loginProvisionedDevice success")
	}
}

func (e *Login) loginProvision(m libkb.MetaContext) (bool, error) {
	m.Debug("loading login user for %q", e.username)
	ueng := newLoginLoadUser(m.G(), e.username)
	if err := RunEngine2(m, ueng); err != nil {
		return false, err
	}

	if ueng.User().HasCurrentDeviceInCurrentInstall() {
		// Somehow after loading a user we discovered that we are already
		// provisioned. This should not happen.
		m.Debug("loginProvisionedDevice after loginLoadUser (and user had current deivce in current install), failed to login [unexpected]")
		return false, libkb.DeviceAlreadyProvisionedError{}
	}

	m.Debug("attempting device provisioning")

	darg := &loginProvisionArg{
		DeviceType: e.deviceType,
		ClientType: e.clientType,
		User:       ueng.User(),

		PaperKey:   e.PaperKey,
		DeviceName: e.DeviceName,

		naclSigningKeyPair:    e.naclSigningKeyPair,
		naclEncryptionKeyPair: e.naclEncryptionKeyPair,
	}
	deng := newLoginProvision(m.G(), darg)
	if err := RunEngine2(m, deng); err != nil {
		return false, err
	}

	// Skip notifications if we haven't provisioned
	if !deng.LoggedIn() {
		return true, nil
	}

	// If account was reset, rerun the provisioning with the existing session
	if deng.AccountReset() {
		return e.loginProvision(m)
	}

	return false, nil
}

// notProvisionedErr will return true if err signifies that login
// failed because this device has not yet been provisioned.
func (e *Login) notProvisionedErr(m libkb.MetaContext, err error) bool {
	if err == errNoDevice {
		return true
	}
	if err == errNoConfig {
		return true
	}

	m.Debug("notProvisioned, not handling error %s (err type: %T)", err, err)
	return false
}

func (e *Login) sendNotification(m libkb.MetaContext) {
	m.G().NotifyRouter.HandleLogin(m.Ctx(), string(m.G().Env.GetUsername()))
	m.G().CallLoginHooks(m)
}

// Get a per-user key.
// Wait for attempt but only warn on error.
func (e *Login) perUserKeyUpgradeSoft(m libkb.MetaContext) error {
	eng := NewPerUserKeyUpgrade(m.G(), &PerUserKeyUpgradeArgs{})
	err := RunEngine2(m, eng)
	if err != nil {
		m.Warning("loginProvision PerUserKeyUpgrade failed: %v", err)
	}
	return err
}

func (e *Login) checkLoggedInAndNotRevoked(m libkb.MetaContext) (bool, error) {
	m.Debug("checkLoggedInAndNotRevoked()")

	username := libkb.NewNormalizedUsername(e.username)

	// CheckForUsername() gets a consistent picture of the current active device,
	// and sees if it matches the given username, and isn't revoked. If all goes
	// well, we return `true,nil`. It could be we're already logged in but for
	// someone else, in which case we return true and an error.
	err := m.ActiveDevice().CheckForUsername(m, username)

	switch err := err.(type) {
	case nil:
		return true, nil
	case libkb.NoActiveDeviceError:
		return false, nil
	case libkb.UserNotFoundError:
		m.Debug("Login: %s", err.Error())
		return false, err
	case libkb.KeyRevokedError, libkb.DeviceNotFoundError:
		m.Debug("Login on revoked or reset device: %s", err.Error())
		if err = m.G().LogoutUsernameWithSecretKill(m, username, true); err != nil {
			m.Debug("logout error: %s", err)
		}
		return false, err
	case libkb.LoggedInWrongUserError:
		m.Debug(err.Error())
		if e.doUserSwitch {
			m.G().ClearStateForSwitchUsers(m)
			return false, nil
		}
		return true, libkb.LoggedInError{}
	default:
		m.Debug("Login: unexpected error: %s", err.Error())
		return false, fmt.Errorf("unexpected error in Login: %s", err.Error())
	}
}

func (e *Login) loginProvisionedDevice(m libkb.MetaContext, username string) (bool, error) {
	eng := NewLoginProvisionedDevice(m.G(), username)
	err := RunEngine2(m, eng)
	if err == nil {
		// login successful
		m.Debug("LoginProvisionedDevice.Run() was successful")
		// Note:  LoginProvisionedDevice Run() will send login notifications, no need to
		// send here.
		return true, nil
	}

	// if this device has been provisioned already and there was an error, then
	// return that error.  Otherwise, ignore it and keep going.
	if !e.notProvisionedErr(m, err) {
		return false, err
	}

	m.Debug("loginProvisionedDevice error: %s (not fatal, can continue to provision this device)", err)

	return false, nil
}

func (e *Login) suggestRecoveryForgotPassword(mctx libkb.MetaContext) error {
	enterReset, err := mctx.UIs().LoginUI.PromptResetAccount(mctx.Ctx(), keybase1.PromptResetAccountArg{
		Kind: keybase1.ResetPromptType_ENTER_FORGOT_PW,
	})
	if err != nil {
		return err
	}
	if !enterReset {
		// Cancel the engine as the user decided to end the flow early.
		return nil
	}

	// We are certain the user will not know their password, so we can disable the prompt.
	eng := NewAccountReset(mctx.G(), e.username)
	eng.skipPasswordPrompt = true
	return eng.Run(mctx)
}

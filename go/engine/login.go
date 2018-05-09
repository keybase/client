// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is the main login engine.

package engine

import (
	"errors"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

var errNoConfig = errors.New("No user config available")
var errNoDevice = errors.New("No device provisioned locally for this user")

// Login is an engine.
type Login struct {
	libkb.Contextified
	deviceType      string
	usernameOrEmail string
	clientType      keybase1.ClientType
}

// NewLogin creates a Login engine.  username is optional.
// deviceType should be libkb.DeviceTypeDesktop or
// libkb.DeviceTypeMobile.
func NewLogin(g *libkb.GlobalContext, deviceType string, usernameOrEmail string, ct keybase1.ClientType) *Login {
	return &Login{
		Contextified:    libkb.NewContextified(g),
		deviceType:      deviceType,
		usernameOrEmail: strings.TrimSpace(usernameOrEmail),
		clientType:      ct,
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
	}
}

// Run starts the engine.
func (e *Login) Run(m libkb.MetaContext) error {
	// check to see if already logged in
	loggedInOK, err := e.checkLoggedInAndNotRevoked(m)
	if err != nil {
		m.CDebugf("Login: error checking if user is logged in: %s", err)
		return err
	}
	if loggedInOK {
		return nil
	}
	m.CDebugf("Login: not currently logged in")

	if len(e.usernameOrEmail) > 0 && libkb.CheckEmail.F(e.usernameOrEmail) {
		// If e.usernameOrEmail is provided and it is an email address, then
		// loginProvisionedDevice is pointless.  It would return an error,
		// but might as well not even use it.
		m.CDebugf("skipping loginProvisionedDevice since %q provided to Login, which looks like an email address.", e.usernameOrEmail)
	} else {
		// First see if this device is already provisioned and it is possible to log in.
		loggedInOK, err := e.loginProvisionedDevice(m, e.usernameOrEmail)
		if err != nil {
			m.CDebugf("loginProvisionedDevice error: %s", err)
			return err
		}
		if loggedInOK {
			m.CDebugf("loginProvisionedDevice success")
			return nil
		}

		m.CDebugf("loginProvisionedDevice failed, continuing with device provisioning")
	}

	// clear out any existing session:
	m.CDebugf("clearing any existing login session with Logout before loading user for login")
	m.G().Logout()

	// run the LoginLoadUser sub-engine to load a user
	m.CDebugf("loading login user for %q", e.usernameOrEmail)
	ueng := newLoginLoadUser(m.G(), e.usernameOrEmail)
	if err := RunEngine2(m, ueng); err != nil {
		return err
	}

	// make sure the user isn't already provisioned (can
	// get here if usernameOrEmail is an email address
	// for an already provisioned on this device user).
	if ueng.User().HasCurrentDeviceInCurrentInstall() {
		m.CDebugf("user %q (%s) has previously provisioned this device, trying to login on it", e.usernameOrEmail, ueng.User().GetName())
		loggedInOK, err := e.loginProvisionedDevice(m, ueng.User().GetName())
		if err != nil {
			m.CDebugf("loginProvisionedDevice after loginLoadUser error: %s", err)
			return err
		}
		if loggedInOK {
			m.CDebugf("loginProvisionedDevice after loginLoadUser success")
			return nil
		}

		// this shouldn't happen:
		m.CDebugf("loginProvisionedDevice after loginLoadUser (and user had current deivce in current install), failed to login [unexpected]")
		return libkb.DeviceAlreadyProvisionedError{}
	}

	m.CDebugf("attempting device provisioning")

	darg := &loginProvisionArg{
		DeviceType: e.deviceType,
		ClientType: e.clientType,
		User:       ueng.User(),
	}
	deng := newLoginProvision(m.G(), darg)
	if err := RunEngine2(m, deng); err != nil {
		return err
	}

	e.perUserKeyUpgradeSoft(m)

	m.CDebugf("Login provisioning success, sending login notification")
	e.sendNotification(m)
	return nil
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

	m.CDebugf("notProvisioned, not handling error %s (err type: %T)", err, err)
	return false
}

func (e *Login) sendNotification(m libkb.MetaContext) {
	m.G().NotifyRouter.HandleLogin(string(m.G().Env.GetUsername()))
	m.G().CallLoginHooks()
}

// Get a per-user key.
// Wait for attempt but only warn on error.
func (e *Login) perUserKeyUpgradeSoft(m libkb.MetaContext) error {
	eng := NewPerUserKeyUpgrade(m.G(), &PerUserKeyUpgradeArgs{})
	err := RunEngine2(m, eng)
	if err != nil {
		m.CWarningf("loginProvision PerUserKeyUpgrade failed: %v", err)
	}
	return err
}

func (e *Login) checkLoggedInAndNotRevoked(m libkb.MetaContext) (bool, error) {
	loggedInOK, err := e.checkLoggedIn(m)
	if err != nil {
		return loggedInOK, err
	}
	if !loggedInOK {
		return loggedInOK, nil
	}

	m.CDebugf("user is logged in, checking if on a revoked device")
	validDevice := false
	err = m.G().GetFullSelfer().WithSelfForcePoll(m.Ctx(), func(me *libkb.User) error {
		validDevice = me.HasCurrentDeviceInCurrentInstall()
		return nil
	})
	if err != nil {
		return false, err
	}
	if validDevice {
		m.CDebugf("user is logged in on a valid device")
		return true, nil
	}

	m.CDebugf("user is logged in on a revoked device, logging out then proceeding to login")
	if err := m.G().Logout(); err != nil {
		m.CDebugf("logout error: %s", err)
		return false, err
	}

	return false, nil
}

func (e *Login) checkLoggedIn(m libkb.MetaContext) (bool, error) {
	m.CDebugf("checkLoggedIn()")
	if !m.ActiveDevice().Valid() {
		return false, nil
	}

	if len(e.usernameOrEmail) == 0 {
		m.CDebugf("Login: already logged in, no username or email provided, so returning without error")
		return true, nil
	}
	if libkb.CheckEmail.F(e.usernameOrEmail) {
		m.CDebugf("Login: already logged in, but %q email address provided.  Can't determine if that is current user without further work, so just returning LoggedInError")
		return true, libkb.LoggedInError{}
	}
	m.CDebugf("checkLoggedIn() looking up username for %s", m.ActiveDevice().UID())
	username, err := m.G().GetUPAKLoader().LookupUsername(m.Ctx(), m.ActiveDevice().UID())
	if err != nil {
		m.CDebugf("checkLoggedIn() LookupUsername error: %s", err)
		return true, err
	}
	if username.Eq(libkb.NewNormalizedUsername(e.usernameOrEmail)) {
		m.CDebugf("Login: already logged in as %q, returning without error", e.usernameOrEmail)
		return true, nil
	}

	m.CDebugf("Login: logged in already as %q (%q requested), returning LoggedInError", username, e.usernameOrEmail)
	return true, libkb.LoggedInError{}

}

func (e *Login) loginProvisionedDevice(m libkb.MetaContext, username string) (bool, error) {
	eng := NewLoginProvisionedDevice(m.G(), username)
	err := RunEngine2(m, eng)
	if err == nil {
		// login successful
		m.CDebugf("LoginProvisionedDevice.Run() was successful")
		// Note:  LoginProvisionedDevice Run() will send login notifications, no need to
		// send here.
		return true, nil
	}

	// if this device has been provisioned already and there was an error, then
	// return that error.  Otherwise, ignore it and keep going.
	if !e.notProvisionedErr(m, err) {
		return false, err
	}

	m.CDebugf("loginProvisionedDevice error: %s (not fatal, can continue to provision this device)", err)

	return false, nil
}

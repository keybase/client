// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// loginProvisionedDevice is an engine that tries to login using the
// current device, if there is an existing provisioned device.
type loginProvisionedDevice struct {
	libkb.Contextified
	username string
}

// newLoginCurrentDevice creates a loginProvisionedDevice engine.
func newLoginProvisionedDevice(g *libkb.GlobalContext, username string) *loginProvisionedDevice {
	return &loginProvisionedDevice{
		username:     username,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *loginProvisionedDevice) Name() string {
	return "loginProvisionedDevice"
}

// GetPrereqs returns the engine prereqs.
func (e *loginProvisionedDevice) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *loginProvisionedDevice) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LoginUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *loginProvisionedDevice) SubConsumers() []libkb.UIConsumer {
	return nil
}

func (e *loginProvisionedDevice) Run(ctx *Context) error {
	// already logged in?
	in, err := e.G().LoginState().LoggedInProvisionedLoad()
	if err == nil && in {
		if len(e.username) == 0 || e.G().Env.GetUsername() == libkb.NewNormalizedUsername(e.username) {
			// already logged in, make sure to unlock device keys
			return e.unlockDeviceKeys(ctx, nil)
		}
	}

	var config *libkb.UserConfig
	loadUserArg := libkb.LoadUserArg{
		PublicKeyOptional: true,
		ForceReload:       true,
	}
	if len(e.username) == 0 {
		e.G().Log.Debug("| using current username")
		config, err = e.G().Env.GetConfig().GetUserConfig()
		loadUserArg.Self = true
	} else {
		e.G().Log.Debug("| using new username %s", e.username)
		nu := libkb.NewNormalizedUsername(e.username)
		config, err = e.G().Env.GetConfig().GetUserConfigForUsername(nu)
		loadUserArg.Name = e.username
	}
	if err != nil {
		e.G().Log.Debug("error getting user config: %s (%T)", err, err)
		return errNoConfig
	}
	if config == nil {
		e.G().Log.Debug("user config is nil")
		return errNoConfig
	}
	deviceID := config.GetDeviceID()
	if deviceID.IsNil() {
		e.G().Log.Debug("no device in user config")
		return errNoDevice
	}

	// Make sure the device ID is still valid.
	me, err := libkb.LoadUser(loadUserArg)
	if err != nil {
		e.G().Log.Debug("error loading user profile: %#v", err)
		return err
	}
	if !me.HasDeviceInCurrentInstall(deviceID) {
		e.G().Log.Debug("current device is not valid")
		return errNoDevice
	}

	// set e.username so that LoginUI never needs to ask for it
	e.username = me.GetName()

	// at this point, there is a user config either for the current user or for e.username
	// and it has a device id, so this should be a provisioned device.  Thus, they should
	// just login normally.

	var afterLogin = func(lctx libkb.LoginContext) error {
		if err := lctx.LocalSession().SetDeviceProvisioned(e.G().Env.GetDeviceID()); err != nil {
			// not a fatal error, session will stay in memory
			e.G().Log.Warning("error saving session file: %s", err)
		}
		return nil
	}
	if err := e.G().LoginState().LoginWithPrompt(e.username, ctx.LoginUI, ctx.SecretUI, afterLogin); err != nil {
		return err
	}

	// login was successful, unlock the device keys
	return e.unlockDeviceKeys(ctx, me)
}

func (e *loginProvisionedDevice) unlockDeviceKeys(ctx *Context, me *libkb.User) error {
	if me == nil {
		var err error
		me, err = libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
		if err != nil {
			return err
		}
	}

	ska := libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}
	_, err := e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "unlock device keys"))
	if err != nil {
		return err
	}
	ska.KeyType = libkb.DeviceEncryptionKeyType
	_, err = e.G().Keyrings.GetSecretKeyWithPrompt(ctx.SecretKeyPromptArg(ska, "unlock device keys"))
	if err != nil {
		return err
	}

	return nil
}

// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// LoginProvisionedDevice is an engine that tries to login using the
// current device, if there is an existing provisioned device.
type LoginProvisionedDevice struct {
	libkb.Contextified
	username        string
	SecretStoreOnly bool // this should only be set by the service on its startup login attempt
}

// newLoginCurrentDevice creates a loginProvisionedDevice engine.
func NewLoginProvisionedDevice(g *libkb.GlobalContext, username string) *LoginProvisionedDevice {
	return &LoginProvisionedDevice{
		username:     username,
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

func (e *LoginProvisionedDevice) Run(ctx *Context) error {
	if err := e.run(ctx); err != nil {
		return err
	}

	e.G().Log.Debug("LoginProvisionedDevice success, sending login notification")
	e.G().NotifyRouter.HandleLogin(string(e.G().Env.GetUsername()))
	e.G().Log.Debug("LoginProvisionedDevice success, calling login hooks")
	e.G().CallLoginHooks()

	return nil
}

func (e *LoginProvisionedDevice) run(ctx *Context) error {
	// already logged in?
	in, err := e.G().LoginState().LoggedInProvisionedCheck()
	if err == nil && in {
		if len(e.username) == 0 || e.G().Env.GetUsername() == libkb.NewNormalizedUsername(e.username) {
			// already logged in, make sure to unlock device keys
			var partialCopy *libkb.User
			err = e.G().GetFullSelfer().WithSelf(ctx.NetContext, func(user *libkb.User) error {

				// We don't want to hold onto the full cached user during
				// the whole `unlockDeviceKey` run below, which touches
				// a lot of (potentially reentrant) code. A partial copy
				// will suffice. We won't need the non-copied fields
				// (like the sigchain and ID table).
				partialCopy = user.PartialCopy()
				return nil
			})
			if err != nil {
				return err
			}
			return e.unlockDeviceKeys(ctx, partialCopy)
		}
	}

	var config *libkb.UserConfig
	loadUserArg := libkb.LoadUserArg{
		PublicKeyOptional: true,
		ForceReload:       true,
	}
	var nu libkb.NormalizedUsername
	if len(e.username) == 0 {
		e.G().Log.Debug("| using current username")
		config, err = e.G().Env.GetConfig().GetUserConfig()
		loadUserArg.Self = true
	} else {
		e.G().Log.Debug("| using new username %s", e.username)
		nu = libkb.NewNormalizedUsername(e.username)
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

		// If our config file is showing that we have a bogus
		// deviceID (maybe from our account before an account reset),
		// then we'll delete it from the config file here, so later parts
		// of provisioning aren't confused by this device ID.
		err := e.G().Env.GetConfigWriter().NukeUser(nu)
		if err != nil {
			e.G().Log.Warning("Error clearing user config: %s", err)
		}
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

	if e.SecretStoreOnly {
		if err := e.G().LoginState().LoginWithStoredSecret(e.username, afterLogin); err != nil {
			return err
		}

	} else {
		if err := e.G().LoginState().LoginWithPrompt(e.username, ctx.LoginUI, ctx.SecretUI, afterLogin); err != nil {
			return err
		}
	}

	// login was successful, unlock the device keys
	err = e.unlockDeviceKeys(ctx, me)
	if err != nil {
		return err
	}
	return nil
}

func (e *LoginProvisionedDevice) unlockDeviceKeys(ctx *Context, me *libkb.User) error {

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

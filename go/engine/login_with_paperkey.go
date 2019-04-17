// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This engine makes sure the user is logged in and unlocked.
// It asks for a paper key if need be. It does not ask for a passphrase.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// LoginWithPaperKey is an engine.
type LoginWithPaperKey struct {
	libkb.Contextified
	username string
}

// NewLoginWithPaperKey creates a LoginWithPaperKey engine.
// Uses the paperkey to log in and unlock LKS.
func NewLoginWithPaperKey(g *libkb.GlobalContext, username string) *LoginWithPaperKey {
	return &LoginWithPaperKey{
		Contextified: libkb.NewContextified(g),
		username:     username,
	}
}

// Name is the unique engine name.
func (e *LoginWithPaperKey) Name() string {
	return "LoginWithPaperKey"
}

// GetPrereqs returns the engine prereqs.
func (e *LoginWithPaperKey) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *LoginWithPaperKey) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
		libkb.SecretUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *LoginWithPaperKey) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
func (e *LoginWithPaperKey) Run(m libkb.MetaContext) (err error) {
	var me *libkb.User
	if e.username == "" {
		me, err = libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m).WithForceReload())
		if err != nil {
			return err
		}
	} else {
		me, err = libkb.LoadUser(libkb.NewLoadUserArgWithMetaContext(m).WithForceReload().WithName(e.username))
		if err != nil {
			return err
		}
	}

	if loggedIn, _ := isLoggedIn(m); loggedIn {
		m.Debug("Already logged in with unlocked device keys")
		return nil
	}

	// Prompts for a paper key.
	m.Debug("No device keys available; getting paper key")
	kp, err := findPaperKeys(m, me)
	if err != nil {
		return err
	}

	// Switch config file to our new user, and zero out the current active device.
	if err = m.SwitchUser(me.GetNormalizedName()); err != nil {
		return err
	}

	// Convert our paper keys into a provisional active device, to use for
	// API session authentication. BAM! We're "logged in".
	m = m.WithProvisioningKeyActiveDevice(kp, me.ToUserVersion())

	// Get the LKS client half.
	gen, clientLKS, err := fetchLKS(m, kp.EncryptionKey())
	if err != nil {
		return err
	}
	lks := libkb.NewLKSecWithClientHalf(clientLKS, gen, me.GetUID())
	m.Debug("Got LKS client half")

	// Get the LKS server half.
	err = lks.Load(m)
	if err != nil {
		return err
	}
	m.Debug("Got LKS full")

	secretStore := libkb.NewSecretStore(m.G(), me.GetNormalizedName())
	m.Debug("Got secret store")

	// Extract the LKS secret
	secret, err := lks.GetSecret(m)
	if err != nil {
		return err
	}
	m.Debug("Got LKS secret")

	err = secretStore.StoreSecret(m, secret)
	if err != nil {
		return err
	}
	m.Debug("Stored secret with LKS from paperkey")

	// Remove our provisional active device, and fall back to global device
	m = m.WithGlobalActiveDevice()

	// This could prompt but shouldn't because of the secret store.
	if _, err = libkb.BootstrapActiveDeviceFromConfig(m, true); err != nil {
		return err
	}
	m.Debug("Unlocked device keys")

	m.Debug("LoginWithPaperkey success, sending login notification")
	m.G().NotifyRouter.HandleLogin(m.Ctx(), string(m.G().Env.GetUsername()))
	m.Debug("LoginWithPaperkey success, calling login hooks")
	m.G().CallLoginHooks(m)

	return nil
}

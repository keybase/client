// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This engine makes sure the user is logged in and unlocked.
// It asks for a paper key if need be. It does not ask for a passphrase.

package engine

import "github.com/keybase/client/go/libkb"

// LoginWithPaperKey is an engine.
type LoginWithPaperKey struct {
	libkb.Contextified
}

// NewLoginWithPaperKey creates a LoginWithPaperKey engine.
// Uses the paperkey to log in and unlock LKS.
func NewLoginWithPaperKey(g *libkb.GlobalContext) *LoginWithPaperKey {
	return &LoginWithPaperKey{
		Contextified: libkb.NewContextified(g),
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
func (e *LoginWithPaperKey) Run(m libkb.MetaContext) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m).WithForceReload())
	if err != nil {
		return err
	}

	kp, err := findDeviceKeys(m, me)
	if err == nil {
		// Device keys are unlocked. Just log in with them.
		m.CDebugf("Logging in with unlocked device key")
		err = e.G().LoginState().LoginWithKey(m, me, kp.sigKey, nil)
		return err
	}

	// Prompts for a paper key.
	m.CDebugf("No device keys available; getting paper key")
	kp, err = findPaperKeys(m, me)
	if err != nil {
		return err
	}

	// Switch config file to our new user, and zero out the current active device.
	if err = m.SwitchUser(me.GetNormalizedName()); err != nil {
		return err
	}

	// Convert our paper keys into a provisional active device, to use for
	// API session authentication. BAM! We're "logged in".
	m = m.WithActiveDevice(kp.toActiveDevice(m, me.GetUID()))

	// Get the LKS client half.
	gen, clientLKS, err := fetchLKS(m, kp.encKey)
	if err != nil {
		return err
	}
	lks := libkb.NewLKSecWithClientHalf(clientLKS, gen, me.GetUID(), m.G())
	m.CDebugf("Got LKS client half")

	// Get the LKS server half.
	err = lks.Load(m)
	if err != nil {
		return err
	}
	m.CDebugf("Got LKS full")

	secretStore := libkb.NewSecretStore(m.G(), me.GetNormalizedName())
	m.CDebugf("Got secret store")

	// Extract the LKS secret
	secret, err := lks.GetSecret(m)
	if err != nil {
		return err
	}
	m.CDebugf("Got LKS secret")

	err = secretStore.StoreSecret(secret)
	if err != nil {
		return err
	}
	m.CDebugf("Stored secret with LKS from paperkey")

	// Remove our provisional active device, and fall back to global device
	m = m.WithGlobalActiveDevice()

	// This could prompt but shouldn't because of the secret store.
	if _, err = libkb.BootstrapActiveDeviceFromConfig(m, true); err != nil {
		return err
	}
	m.CDebugf("Unlocked device keys")

	m.CDebugf("LoginWithPaperkey success, sending login notification")
	m.G().NotifyRouter.HandleLogin(string(m.G().Env.GetUsername()))
	m.CDebugf("LoginWithPaperkey success, calling login hooks")
	m.G().CallLoginHooks()

	return nil
}

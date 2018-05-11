// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"github.com/keybase/client/go/libkb"
)

// PGPProvision is an engine.
type PGPProvision struct {
	libkb.Contextified
	username   string
	deviceName string
	passphrase string
	user       *libkb.User
}

// NewPGPProvision creates a PGPProvision engine.
func NewPGPProvision(g *libkb.GlobalContext, username, deviceName, passphrase string) *PGPProvision {
	return &PGPProvision{
		Contextified: libkb.NewContextified(g),
		username:     username,
		deviceName:   deviceName,
		passphrase:   passphrase,
	}
}

// Name is the unique engine name.
func (e *PGPProvision) Name() string {
	return "PGPProvision"
}

// GetPrereqs returns the engine prereqs.
func (e *PGPProvision) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *PGPProvision) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *PGPProvision) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&loginLoadUser{},
		&DeviceWrap{},
	}
}

// Run starts the engine.
func (e *PGPProvision) Run(m libkb.MetaContext) error {
	m.G().LocalSigchainGuard().Set(m.Ctx(), "PGPProvision")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "PGPProvision")

	// clear out any existing session:
	m.G().Logout()

	// transaction around config file
	tx, err := m.G().Env.GetConfigWriter().BeginTransaction()
	if err != nil {
		return err
	}

	// From this point on, if there's an error, we abort the
	// transaction.
	defer func() {
		if tx != nil {
			tx.Abort()
		}
	}()

	// run the LoginLoadUser sub-engine to load a user
	ueng := newLoginLoadUser(e.G(), e.username)
	if err = RunEngine2(m, ueng); err != nil {
		return err
	}

	// make sure the user isn't already provisioned (can
	// get here if usernameOrEmail is an email address
	// for an already provisioned on this device user).
	if ueng.User().HasCurrentDeviceInCurrentInstall() {
		return libkb.DeviceAlreadyProvisionedError{}
	}
	e.user = ueng.User()

	return e.provision(m)
}

// provision attempts to provision with a synced pgp key.  It
// needs to get a session first to look for a synced pgp key.
func (e *PGPProvision) provision(m libkb.MetaContext) error {
	// After obtaining login session, this will be called before the login state is released.
	// It tries to get the pgp key and uses it to provision new device keys for this device.
	var afterLogin = func(lctx libkb.LoginContext) error {
		m = m.WithLoginContext(lctx)
		signer, err := e.syncedPGPKey(m)
		if err != nil {
			return err
		}

		if err := e.makeDeviceKeysWithSigner(m, signer); err != nil {
			return err
		}
		if err := lctx.LocalSession().SetDeviceProvisioned(m.G().Env.GetDeviceID()); err != nil {
			// not a fatal error, session will stay in memory
			m.CWarningf("error saving session file: %s", err)
		}
		return nil
	}

	// need a session to try to get synced private key
	err := m.G().LoginState().LoginWithPassphrase(m, e.user.GetName(), e.passphrase, false, afterLogin)
	if err != nil {
		return err
	}

	// Get a per-user key.
	// Wait for attempt but only warn on error.
	eng := NewPerUserKeyUpgrade(m.G(), &PerUserKeyUpgradeArgs{})
	err = RunEngine2(m, eng)
	if err != nil {
		m.CWarningf("PGPProvision PerUserKeyUpgrade failed: %v", err)
	}
	return nil
}

// syncedPGPKey looks for a synced pgp key for e.user.  If found,
// it unlocks it.
func (e *PGPProvision) syncedPGPKey(m libkb.MetaContext) (libkb.GenericKey, error) {
	key, err := e.user.SyncedSecretKey(m)
	if err != nil {
		return nil, err
	}
	if key == nil {
		return nil, libkb.NoSyncedPGPKeyError{}
	}

	m.CDebugf("got synced secret key")

	// unlock it
	parg := m.SecretKeyPromptArg(libkb.SecretKeyArg{}, "sign new device")
	unlocked, err := key.PromptAndUnlock(m, parg, nil, e.user)
	if err != nil {
		return nil, err
	}

	m.CDebugf("unlocked secret key")
	return unlocked, nil
}

// makeDeviceKeysWithSigner creates device keys given a signing
// key.
func (e *PGPProvision) makeDeviceKeysWithSigner(m libkb.MetaContext, signer libkb.GenericKey) error {
	args, err := e.makeDeviceWrapArgs(m)
	if err != nil {
		return err
	}
	args.Signer = signer
	args.IsEldest = false // just to be explicit
	args.EldestKID = e.user.GetEldestKID()

	return e.makeDeviceKeys(m, args)
}

// makeDeviceWrapArgs creates a base set of args for DeviceWrap.
func (e *PGPProvision) makeDeviceWrapArgs(m libkb.MetaContext) (*DeviceWrapArgs, error) {
	// generate lks
	salt, err := m.LoginContext().LoginSession().Salt()
	if err != nil {
		return nil, err
	}
	_, pps, err := libkb.StretchPassphrase(m.G(), e.passphrase, salt)
	if err != nil {
		return nil, err
	}
	// since this is just for testing, ok to set this explicitly
	pps.SetGeneration(1)
	lks := libkb.NewLKSec(pps, e.user.GetUID(), e.G())

	return &DeviceWrapArgs{
		Me:         e.user,
		DeviceName: e.deviceName,
		DeviceType: libkb.DeviceTypeDesktop,
		Lks:        lks,
	}, nil
}

// makeDeviceKeys uses DeviceWrap to generate device keys.
func (e *PGPProvision) makeDeviceKeys(m libkb.MetaContext, args *DeviceWrapArgs) error {
	eng := NewDeviceWrap(e.G(), args)
	return RunEngine2(m, eng)
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// XXX: THIS ENGINE DELETES SECRET KEYS. Deleting the wrong secret keys can
// make you lose all your data forever. Apart from `keybase deprovision`, which
// shows a ton of SCARY ALL CAPS prompts to the user, we probably never want to
// use this engine.
type DeprovisionEngine struct {
	libkb.Contextified
	username libkb.NormalizedUsername
	doRevoke bool // requires being logged in already
}

func NewDeprovisionEngine(g *libkb.GlobalContext, username string, doRevoke bool) *DeprovisionEngine {
	return &DeprovisionEngine{
		Contextified: libkb.NewContextified(g),
		username:     libkb.NewNormalizedUsername(username),
		doRevoke:     doRevoke,
	}
}

func (e *DeprovisionEngine) Name() string {
	return "Deprovision"
}

func (e *DeprovisionEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *DeprovisionEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

func (e *DeprovisionEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{
		&RevokeEngine{},
	}
}

// This function anticipates some error cases (particularly that the device may
// be already revoked), but it will still return an error if something
// unexpected goes wrong.
func (e *DeprovisionEngine) attemptLoggedInRevoke(m libkb.MetaContext) error {
	m.G().LocalSigchainGuard().Set(m.Ctx(), "DeprovisionEngine")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "DeprovisionEngine")

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(m))
	if err != nil {
		m.CDebugf("DeprovisionEngine error loading current user: %s", err)
		return err
	}
	nun := me.GetNormalizedName()

	keys, err := me.GetComputedKeyFamily().GetAllActiveKeysForDevice(m.G().Env.GetDeviceIDForUsername(nun))
	if err != nil {
		e.G().Log.Debug("DeprovisionEngine error loading keys for current device: %s", err)
		return err
	}

	// If there are no keys to revoke, it's likely the device has already been
	// revoked. We still need to log out below though.
	if len(keys) == 0 {
		m.UIs().LogUI.Warning("No active keys to revoke.")
	} else {
		// Do the revoke. We expect this to succeed.
		revokeArg := RevokeDeviceEngineArgs{
			ID:        m.G().Env.GetDeviceIDForUsername(nun),
			ForceSelf: true,
			ForceLast: true,
		}
		revokeEng := NewRevokeDeviceEngine(m.G(), revokeArg)
		err = revokeEng.Run(m)
		if err != nil {
			m.CDebugf("DeprovisionEngine error during revoke: %s", err)
			return err
		}
	}

	m.UIs().LogUI.Info("Logging out...")
	if err = m.G().Logout(); err != nil {
		m.CDebugf("DeprovisionEngine error during logout: %s", err)
		return err
	}

	return nil
}

func (e *DeprovisionEngine) Run(m libkb.MetaContext) (err error) {
	// Deprovision steps
	// =================
	// 1. If the user is logged in:
	//   a) Revoke all the current device's keys.
	//   b) Log out.
	// 2. Delete all the user's secret keys!!!
	// 3. Delete the user from the config file.
	// 4. Db nuke.

	if e.doRevoke {
		err = e.attemptLoggedInRevoke(m)
		if err != nil {
			return
		}
	}

	logui := m.UIs().LogUI

	if clearSecretErr := libkb.ClearStoredSecret(m.G(), e.username); clearSecretErr != nil {
		m.CWarningf("ClearStoredSecret error: %s", clearSecretErr)
	}

	// XXX: Delete the user's secret keyring. It's very important that we never
	// do this to the wrong user. Please do not copy this code :)
	logui.Info("Deleting %s's secret keys file...", e.username.String())
	filename := m.G().SKBFilenameForUser(e.username)
	err = libkb.ShredFile(filename)
	if err != nil {
		return fmt.Errorf("Failed to delete secret key file: %s", err)
	}

	logui.Info("Deleting %s from config.json...", e.username.String())
	if err = m.G().Env.GetConfigWriter().NukeUser(e.username); err != nil {
		return
	}

	// The config entries we just nuked could still be in memory. Clear them.
	m.G().Env.GetConfigWriter().SetUserConfig(nil, true /* overwrite; ignored */)

	logui.Info("Clearing the local cache db...")
	if _, err = m.G().LocalDb.Nuke(); err != nil {
		return
	}

	logui.Info("Deprovision finished.")
	return
}

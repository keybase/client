// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
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
		m.Debug("DeprovisionEngine error loading current user: %s", err)
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
		if err = revokeEng.Run(m); err != nil {
			m.Debug("DeprovisionEngine error during revoke: %s", err)
			return err
		}
	}

	m.UIs().LogUI.Info("Logging out...")
	if err = m.G().Logout(m.Ctx()); err != nil {
		m.Debug("DeprovisionEngine error during logout: %s", err)
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
	// 3. Delete the user's ephemeralKeys
	// 4. Delete the user from the config file.
	// 5. Db nuke.

	if e.doRevoke {
		if err = e.attemptLoggedInRevoke(m); err != nil {
			return err
		}
	}

	if err = libkb.ClearSecretsOnDeprovision(m, e.username); err != nil {
		m.Debug("DeprovisionEngine error during clear secrets: %s", err)
	}
	return nil
}

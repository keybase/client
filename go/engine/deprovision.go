// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"os"

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
func (e *DeprovisionEngine) attemptLoggedInRevoke(ctx *Context) error {
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))
	if err != nil {
		e.G().Log.Debug("DeprovisionEngine error loading current user: %s", err)
		return err
	}
	nun := me.GetNormalizedName()

	keys, err := me.GetComputedKeyFamily().GetAllActiveKeysForDevice(e.G().Env.GetDeviceIDForUsername(nun))
	if err != nil {
		e.G().Log.Debug("DeprovisionEngine error loading keys for current device: %s", err)
		return err
	}

	// If there are no keys to revoke, it's likely the device has already been
	// revoked. We still need to log out below though.
	if len(keys) == 0 {
		ctx.LogUI.Warning("No active keys to revoke.")
	} else {
		// Do the revoke. We expect this to succeed.
		revokeArg := RevokeDeviceEngineArgs{
			ID:    e.G().Env.GetDeviceIDForUsername(nun),
			Force: true,
		}
		revokeEng := NewRevokeDeviceEngine(revokeArg, e.G())
		err = revokeEng.Run(ctx)
		if err != nil {
			e.G().Log.Debug("DeprovisionEngine error during revoke: %s", err)
			return err
		}
	}

	ctx.LogUI.Info("Logging out...")
	if err = e.G().Logout(); err != nil {
		e.G().Log.Debug("DeprovisionEngine error during logout: %s", err)
		return err
	}

	return nil
}

func (e *DeprovisionEngine) Run(ctx *Context) (err error) {
	// Deprovision steps
	// =================
	// 1. If the user is logged in:
	//   a) Revoke all the current device's keys.
	//   b) Log out.
	// 2. Delete all the user's secret keys!!!
	// 3. Delete the user from the config file.
	// 4. Db nuke.

	if e.doRevoke {
		err = e.attemptLoggedInRevoke(ctx)
		if err != nil {
			return
		}
	}

	if clearSecretErr := libkb.ClearStoredSecret(e.G(), e.username); clearSecretErr != nil {
		e.G().Log.Warning("ClearStoredSecret error: %s", clearSecretErr)
	}

	// XXX: Delete the user's secret keyring. It's very important that we never
	// do this to the wrong user. Please do not copy this code :)
	ctx.LogUI.Info("Deleting %s's secret keys file...", e.username.String())
	filename := e.G().SKBFilenameForUser(e.username)
	err = os.Remove(filename)
	if err != nil {
		return fmt.Errorf("Failed to delete secret key file: %s", err)
	}

	ctx.LogUI.Info("Deleting %s from config.json...", e.username.String())
	if err = e.G().Env.GetConfigWriter().NukeUser(e.username); err != nil {
		return
	}

	// The config entries we just nuked could still be in memory. Clear them.
	e.G().Env.GetConfigWriter().SetUserConfig(nil, true /* overwrite; ignored */)

	ctx.LogUI.Info("Clearing the local cache db...")
	if _, err = e.G().LocalDb.Nuke(); err != nil {
		return
	}

	ctx.LogUI.Info("Deprovision finished.")
	return
}

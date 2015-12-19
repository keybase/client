// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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
}

func NewDeprovisionEngine(g *libkb.GlobalContext, username string) *DeprovisionEngine {
	return &DeprovisionEngine{
		Contextified: libkb.NewContextified(g),
		username:     libkb.NewNormalizedUsername(username),
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

func (e *DeprovisionEngine) Run(ctx *Context) (err error) {
	// Deprovision steps
	// =================
	// 1. If the user is logged in:
	//   a) Revoke all the current device's keys.
	//   b) Log out.
	// 2. Delete all the user's secret keys!!!
	// 3. Delete the user from the config file.
	// 4. Db nuke.

	// If the user to deprovision is currently logged in, we need to revoke
	// their keys and then log out.
	isLoggedIn, err := IsLoggedIn(e, ctx)
	if err != nil {
		return err
	}
	if e.G().Env.GetUsername().Eq(e.username) && isLoggedIn {
		revokeArg := RevokeDeviceEngineArgs{
			ID:    e.G().Env.GetDeviceID(),
			Force: true,
		}
		revokeEng := NewRevokeDeviceEngine(revokeArg, e.G())
		err = revokeEng.Run(ctx)
		if err != nil {
			return err
		}

		ctx.LogUI.Info("Logging out...")
		if err = e.G().Logout(); err != nil {
			return
		}
	} else {
		ctx.LogUI.Warning("User %s is not logged in, so we aren't revoking their keys on the server.", e.username)
		ctx.LogUI.Warning("To do that yourself, use `keybase device remove` from a logged in device.")
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

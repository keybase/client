package libkb

import (
	"fmt"
)

// XXX: THIS DELETES SECRET KEYS. Deleting the wrong secret keys can make you
// lose all your data forever. We only run this in the DeprovisionEngine and if
// we detect that our device was revoked in LogoutAndDeprovisionIfRevoked.
func ClearSecretsOnDeprovision(m MetaContext, username NormalizedUsername) error {
	// 1. Delete all the user's secret keys!!!
	// 2. Delete the user's ephemeralKeys
	// 3. Delete the user from the config file.
	// 4. Db nuke.

	var logger func(string, ...interface{})
	if m.UIs().LogUI == nil {
		logger = m.CInfof
	} else {
		logger = m.UIs().LogUI.Info
	}

	if clearSecretErr := ClearStoredSecret(m.G(), username); clearSecretErr != nil {
		m.CWarningf("ClearStoredSecret error: %s", clearSecretErr)
	}

	// XXX: Delete the user's secret keyring. It's very important that we never
	// do this to the wrong user. Please do not copy this code :)
	logger("Deleting %s's secret keys file...", username.String())
	filename := m.G().SKBFilenameForUser(username)
	if err := ShredFile(filename); err != nil {
		return fmt.Errorf("Failed to delete secret key file: %s", err)
	}

	logger("Deleting %s's ephemeralKeys...", username.String())
	// NOTE: We only store userEK/teamEK boxes locally and these are removed in
	// the LocalDb.Nuke() below so we just delete any deviceEKs here.
	deviceEKStorage := m.G().GetDeviceEKStorage()
	if deviceEKStorage != nil {
		if err := deviceEKStorage.ForceDeleteAll(m.Ctx(), username); err != nil {
			return err
		}
	}

	logger("Deleting %s from config.json...", username.String())
	if err := m.SwitchUserDeprovisionNukeConfig(username); err != nil {
		return err
	}

	logger("Clearing the local cache db...")
	if _, err := m.G().LocalDb.Nuke(); err != nil {
		return err
	}

	logger("Clearing the local cache chat db...")
	if _, err := m.G().LocalChatDb.Nuke(); err != nil {
		return err
	}

	logger("Deprovision finished.")
	return nil
}

package libkb

// XXX: THIS DELETES SECRET KEYS. Deleting the wrong secret keys can make you
// lose all your data forever. We only run this in the DeprovisionEngine and if
// we detect that our device was revoked in LogoutAndDeprovisionIfRevoked.
func ClearSecretsOnDeprovision(mctx MetaContext, username NormalizedUsername) error {
	// 1. Delete all the user's secret keys!!!
	// 2. Delete the user's ephemeralKeys
	// 3. Delete the user from the config file.
	// 4. Db nuke.

	epick := FirstErrorPicker{}

	var logger func(string, ...interface{})
	if mctx.UIs().LogUI == nil {
		logger = mctx.Info
	} else {
		logger = mctx.UIs().LogUI.Info
	}

	if clearSecretErr := ClearStoredSecret(mctx, username); clearSecretErr != nil {
		mctx.Warning("ClearStoredSecret error: %s", clearSecretErr)
	}

	// XXX: Delete the user's secret keyring. It's very important that we never
	// do this to the wrong user. Please do not copy this code :)
	logger("Deleting %s's secret keys file...", username.String())
	filename := mctx.G().SKBFilenameForUser(username)
	epick.Push(ShredFile(filename))

	logger("Deleting %s's ephemeralKeys...", username.String())
	// NOTE: We only store userEK/teamEK boxes locally and these are removed in
	// the LocalDb.Nuke() below so we just delete any deviceEKs here.
	deviceEKStorage := mctx.G().GetDeviceEKStorage()
	if deviceEKStorage != nil {
		epick.Push(deviceEKStorage.ForceDeleteAll(mctx, username))
	}

	logger("Deleting %s from config.json...", username.String())
	epick.Push(mctx.SwitchUserDeprovisionNukeConfig(username))

	logger("Clearing the local cache db...")
	_, err := mctx.G().LocalDb.Nuke()
	epick.Push(err)

	logger("Clearing the local cache chat db...")
	_, err = mctx.G().LocalChatDb.Nuke()
	epick.Push(err)

	logger("Deprovision finished.")
	return epick.Error()
}

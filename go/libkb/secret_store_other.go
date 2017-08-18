// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!android

package libkb

func NewSecretStoreAll(g *GlobalContext) SecretStoreAll {
	s := NewSecretStoreFile(g.Env.GetDataDir())
	s.notifyCreate = func(name NormalizedUsername) { notifySecretStoreCreate(g, name) }
	return s
}

func notifySecretStoreCreate(g *GlobalContext, username NormalizedUsername) {
	g.Log.Debug("got secret store file notifyCreate")

	// check leveldb for existence of notification dismissal
	dbobj, found, err := g.LocalDb.GetRaw(DbKeyNotificationDismiss(NotificationDismissPGPPrefix, username))
	if err != nil {
		g.Log.Debug("notifySecretStoreCreate: localDb.GetRaw error: %s", err)
		return
	}
	if found && string(dbobj) == NotificationDismissPGPValue {
		g.Log.Debug("notifySecretStoreCreate: %s already dismissed", NotificationDismissPGPPrefix)
		return
	}

	// check keyring for pgp keys
	// can't use the keyring in LoginState because this could be called
	// within a LoginState request.
	kr, err := LoadSKBKeyring(username, g)
	if err != nil {
		g.Log.Debug("LoadSKBKeyring error: %s", err)
		return
	}
	blocks, err := kr.AllPGPBlocks()
	if err != nil {
		g.Log.Debug("keyring.AllPGPBlocks error: %s", err)
		return
	}

	if len(blocks) == 0 {
		g.Log.Debug("notifySecretStoreCreate: no pgp blocks in keyring")
		return
	}

	// pgp blocks exist, send a notification
	g.Log.Debug("user has pgp blocks in keyring, sending notification")
	if g.NotifyRouter != nil {
		g.NotifyRouter.HandlePGPKeyInSecretStoreFile()
	}

	// also log a warning (so CLI users see it)
	g.Log.Info(pgpStorageWarningText)

	// Note: a separate RPC, callable by CLI or electron, will dismiss
	// this warning by inserting into leveldb.
}

const pgpStorageWarningText = `
Policy change on passphrases

We've gotten lots of feedback that it's annoying as all hell to enter a 
Keybase passphrase after restarts and updates. The consensus is you can 
trust a device's storage to keep a secret that's specific to that device.  
Passphrases stink, like passed gas, and are bloody painful, like passed stones.

Note, however: on this device you have a PGP private key in Keybase's local 
keychain.  Some people want to type a passphrase to unlock their PGP key, and 
this new policy would bypass that. If you're such a person, you can run the 
following command to remove your PGP private key. 

    keybase pgp purge

If you do it, you'll have to use GPG for your PGP operations.

If you're ok with the new policy, you can run this command so you won't
get bothered with this message in the future:

    keybase dismiss pgp-storage

Thanks!`

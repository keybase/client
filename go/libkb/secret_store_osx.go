// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,!ios

package libkb

import keychain "github.com/keybase/go-keychain"

func (k KeychainSecretStore) synchronizable() keychain.Synchronizable {
	return keychain.SynchronizableNo
}

func (k KeychainSecretStore) accessible() keychain.Accessible {
	// TODO: Since we access keychain item in launchd service (background), it's
	// appropriate to use after first unlock, though we should consider using
	// "when unlocked" to be more secure: keychain.AccessibleWhenUnlockedThisDeviceOnly
	return keychain.AccessibleAfterFirstUnlockThisDeviceOnly
}

func (k KeychainSecretStore) accessGroup() string {
	// Don't use access group on OS X
	return ""
}

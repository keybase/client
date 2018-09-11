// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,ios

package libkb

import "github.com/keybase/go-keychain"

func (k KeychainSecretStore) accessGroup(m MetaContext) string {
	// GetStoredSecretAccessGroup MUST be "" for the simulator
	return m.G().GetStoredSecretAccessGroup()
}

func (k KeychainSecretStore) synchronizable() keychain.Synchronizable {
	return keychain.SynchronizableNo
}

func (k KeychainSecretStore) accessible() keychain.Accessible {
	return keychain.AccessibleAfterFirstUnlockThisDeviceOnly
}

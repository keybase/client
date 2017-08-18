// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,ios

package libkb

import "github.com/keybase/go-keychain"

func (k KeychainSecretStore) accessGroup() string {
	// GetStoredSecretAccessGroup MUST be "" for the simulator
	return k.context.GetStoredSecretAccessGroup()
}

func (k KeychainSecretStore) synchronizable() keychain.Synchronizable {
	return keychain.SynchronizableNo
}

func (k KeychainSecretStore) accessible() keychain.Accessible {
	return keychain.AccessibleWhenUnlockedThisDeviceOnly
}

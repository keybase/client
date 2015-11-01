// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build darwin,ios

package libkb

import (
	keychain "github.com/keybase/go-keychain"
)

type KeychainSecretStore struct {
	accountName string
}

func (k KeychainSecretStore) StoreSecret(secret []byte) (err error) {
	// GetStoredSecretAccessGroup MUST be "" for the simulator
	item := keychain.NewGenericPassword(G.Env.GetStoredSecretServiceName(), k.accountName, "", secret, G.Env.GetStoredSecretAccessGroup())
	item.SetSynchronizable(keychain.SynchronizableNo)
	item.SetAccessible(keychain.AccessibleWhenUnlockedThisDeviceOnly)

	keychain.DeleteItem(item)
	return keychain.AddItem(item)
}

func (k KeychainSecretStore) RetrieveSecret() ([]byte, error) {
	return keychain.GetGenericPassword(G.Env.GetStoredSecretServiceName(), k.accountName, "", "")
}

func (k KeychainSecretStore) ClearSecret() (err error) {
	query := keychain.NewGenericPassword(G.Env.GetStoredSecretServiceName(), k.accountName, "", nil, "")
	query.SetMatchLimit(keychain.MatchLimitAll)
	return keychain.DeleteItem(query)
}

func NewSecretStore(username NormalizedUsername) SecretStore {
	return KeychainSecretStore{string(username)}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets() ([]string, error) {
	return keychain.GetAccountsForService(G.Env.GetStoredSecretServiceName())
}

func GetTerminalPrompt() string {
	return "Store your key in Apple's local keychain?"
}

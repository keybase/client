// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin,ios

package libkb

import (
	"encoding/base64"

	keychain "github.com/keybase/go-keychain"
)

type KeychainSecretStore struct {
	Contextified
	accountName string
}

var _ SecretStore = KeychainSecretStore{}

func (k KeychainSecretStore) getServiceName() string {
	return k.G().Env.GetStoredSecretServiceName()
}

func (k KeychainSecretStore) getAccessGroup() string {
	// GetStoredSecretAccessGroup MUST be "" for the simulator
	return k.G().Env.GetStoredSecretAccessGroup()
}

func (k KeychainSecretStore) StoreSecret(secret []byte) (err error) {
	encodedSecret := base64.StdEncoding.EncodeToString(secret)
	item := keychain.NewGenericPassword(k.getServiceName(), k.accountName, "", encodedSecret, k.getAccessGroup())
	item.SetSynchronizable(keychain.SynchronizableNo)
	item.SetAccessible(keychain.AccessibleWhenUnlockedThisDeviceOnly)

	keychain.DeleteItem(item)
	return keychain.AddItem(item)
}

func (k KeychainSecretStore) RetrieveSecret() ([]byte, error) {
	encodedSecret, err := keychain.GetGenericPassword(k.getServiceName(), k.accountName, "", "")
	if err != nil {
		return nil, err
	}

	secret, err := base64.StdEncoding.DecodeString(string(encodedSecret))
	if err != nil {
		return nil, err
	}

	return secret, nil
}

func (k KeychainSecretStore) ClearSecret() (err error) {
	query := keychain.NewGenericPassword(k.getServiceName(), k.accountName, "", nil, "")
	query.SetMatchLimit(keychain.MatchLimitAll)
	return keychain.DeleteItem(query)
}

func NewSecretStore(g *GlobalContext, username NormalizedUsername) SecretStore {
	return KeychainSecretStore{
		Contextified: NewContextified(g),
		accountName:  username.String(),
	}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets(g *GlobalContext) ([]string, error) {
	return keychain.GetAccountsForService(g.Env.GetStoredSecretServiceName())
}

func GetTerminalPrompt() string {
	return "Store your key in Apple's local keychain?"
}

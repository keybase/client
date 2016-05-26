// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package libkb

import (
	"encoding/base64"

	keychain "github.com/keybase/go-keychain"
)

type KeychainSecretStore struct {
	context SecretStoreContext
}

var _ SecretStoreAll = KeychainSecretStore{}

func (k KeychainSecretStore) serviceName() string {
	return k.context.GetStoredSecretServiceName()
}

func (k KeychainSecretStore) StoreSecret(accountName NormalizedUsername, secret []byte) (err error) {
	// Base64 encode to make it easy to work with Keychain Access (since we are using a password item and secret is not utf-8)
	encodedSecret := base64.StdEncoding.EncodeToString(secret)
	item := keychain.NewGenericPassword(k.serviceName(), string(accountName), "", []byte(encodedSecret), k.accessGroup())
	item.SetSynchronizable(k.synchronizable())
	item.SetAccessible(k.accessible())
	keychain.DeleteItem(item)
	return keychain.AddItem(item)
}

func (k KeychainSecretStore) RetrieveSecret(accountName NormalizedUsername) ([]byte, error) {
	encodedSecret, err := keychain.GetGenericPassword(k.serviceName(), string(accountName), "", "")
	if err != nil {
		return nil, err
	}
	if encodedSecret == nil {
		return nil, SecretStoreError{Msg: "No secret for " + string(accountName)}
	}

	secret, err := base64.StdEncoding.DecodeString(string(encodedSecret))
	if err != nil {
		return nil, err
	}

	return secret, nil
}

func (k KeychainSecretStore) ClearSecret(accountName NormalizedUsername) error {
	query := keychain.NewGenericPassword(k.serviceName(), string(accountName), "", nil, "")
	query.SetMatchLimit(keychain.MatchLimitAll)
	err := keychain.DeleteItem(query)
	if err == keychain.ErrorItemNotFound {
		return nil
	}
	return err
}

func NewSecretStoreAll(g *GlobalContext) SecretStoreAll {
	return KeychainSecretStore{
		context: g,
	}
}

func NewTestSecretStoreAll(c SecretStoreContext, g *GlobalContext) SecretStoreAll {
	return nil
}

func HasSecretStore() bool {
	return true
}

func (k KeychainSecretStore) GetUsersWithStoredSecrets() ([]string, error) {
	return keychain.GetAccountsForService(k.context.GetStoredSecretServiceName())
}

func (k KeychainSecretStore) GetApprovalPrompt() string {
	return "Save in Keychain"
}

func (k KeychainSecretStore) GetTerminalPrompt() string {
	return "Store your key in Apple's local keychain?"
}

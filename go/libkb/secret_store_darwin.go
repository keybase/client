// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package libkb

import (
	"encoding/base64"

	keychain "github.com/keybase/go-keychain"
)

type KeychainSecretStore struct {
	context     SecretStoreContext
	accountName string
}

var _ SecretStore = KeychainSecretStore{}

func (k KeychainSecretStore) serviceName() string {
	return k.context.GetStoredSecretServiceName()
}

func (k KeychainSecretStore) StoreSecret(secret []byte) (err error) {
	// Base64 encode to make it easy to work with Keychain Access (since we are using a password item and secret is not utf-8)
	encodedSecret := base64.StdEncoding.EncodeToString(secret)
	item := keychain.NewGenericPassword(k.serviceName(), k.accountName, "", []byte(encodedSecret), k.accessGroup())
	item.SetSynchronizable(k.synchronizable())
	item.SetAccessible(k.accessible())
	keychain.DeleteItem(item)
	return keychain.AddItem(item)
}

func (k KeychainSecretStore) RetrieveSecret() ([]byte, error) {
	encodedSecret, err := keychain.GetGenericPassword(k.serviceName(), k.accountName, "", "")
	if err != nil {
		return nil, err
	}
	if encodedSecret == nil {
		return nil, SecretStoreError{Msg: "No secret for " + k.accountName}
	}

	secret, err := base64.StdEncoding.DecodeString(string(encodedSecret))
	if err != nil {
		return nil, err
	}

	return secret, nil
}

func (k KeychainSecretStore) ClearSecret() error {
	query := keychain.NewGenericPassword(k.serviceName(), k.accountName, "", nil, "")
	query.SetMatchLimit(keychain.MatchLimitAll)
	err := keychain.DeleteItem(query)
	if err == keychain.ErrorItemNotFound {
		return nil
	}
	return err
}

func NewSecretStore(context SecretStoreContext, username NormalizedUsername) SecretStore {
	return KeychainSecretStore{
		context:     context,
		accountName: username.String(),
	}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets(c SecretStoreContext) ([]string, error) {
	return keychain.GetAccountsForService(c.GetStoredSecretServiceName())
}

func GetTerminalPrompt() string {
	return "Store your key in Apple's local keychain?"
}

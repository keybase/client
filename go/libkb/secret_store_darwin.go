// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

func (k KeychainSecretStore) StoreSecret(accountName NormalizedUsername, secret LKSecFullSecret) (err error) {
	// Base64 encode to make it easy to work with Keychain Access (since we are using a password item and secret is not utf-8)
	encodedSecret := base64.StdEncoding.EncodeToString(secret.Bytes())
	item := keychain.NewGenericPassword(k.serviceName(), string(accountName), "", []byte(encodedSecret), k.accessGroup())
	item.SetSynchronizable(k.synchronizable())
	item.SetAccessible(k.accessible())
	k.context.GetLog().Debug("KeychainSecretStore.StoreSecret(%s): deleting item before adding new one", accountName)
	err = keychain.DeleteItem(item)
	if err != nil {
		// error probably ok here?
		k.context.GetLog().Debug("KeychainSecretStore.StoreSecret(%s): DeleteItem error: %s", accountName, err)
	}
	k.context.GetLog().Debug("KeychainSecretStore.StoreSecret(%s): adding item", accountName)
	err = keychain.AddItem(item)
	if err != nil {
		k.context.GetLog().Warning("KeychainSecretStore.StoreSecret(%s): AddItem error: %s", accountName, err)
		return err
	}
	k.context.GetLog().Debug("KeychainSecretStore.StoreSecret(%s): AddItem success", accountName)

	return nil
}

func (k KeychainSecretStore) RetrieveSecret(accountName NormalizedUsername) (LKSecFullSecret, error) {
	k.context.GetLog().Debug("KeychainSecretStore.RetrieveSecret(%s)", accountName)
	encodedSecret, err := keychain.GetGenericPassword(k.serviceName(), string(accountName), "", "")
	if err != nil {
		k.context.GetLog().Debug("KeychainSecretStore.RetrieveSecret(%s) error: %s", accountName, err)
		return LKSecFullSecret{}, err
	}
	if encodedSecret == nil {
		k.context.GetLog().Debug("KeychainSecretStore.RetrieveSecret(%s) nil encodedSecret", accountName)
		return LKSecFullSecret{}, SecretStoreError{Msg: "No secret for " + string(accountName)}
	}

	secret, err := base64.StdEncoding.DecodeString(string(encodedSecret))
	if err != nil {
		k.context.GetLog().Debug("KeychainSecretStore.RetrieveSecret(%s) base64.Decode error: %s", accountName, err)
		return LKSecFullSecret{}, err
	}

	k.context.GetLog().Debug("KeychainSecretStore.RetrieveSecret(%s) got secret, creating lksec", accountName)

	lk, err := newLKSecFullSecretFromBytes(secret)
	if err != nil {
		k.context.GetLog().Debug("KeychainSecretStore.RetrieveSecret(%s) error creating lksec: %s", accountName, err)
		return LKSecFullSecret{}, err
	}

	k.context.GetLog().Debug("KeychainSecretStore.RetrieveSecret(%s) success", accountName)

	return lk, nil
}

func (k KeychainSecretStore) ClearSecret(accountName NormalizedUsername) error {
	k.context.GetLog().Debug("KeychainSecretStore.ClearSecret(%s)", accountName)
	var query keychain.Item
	if isIOS {
		query = keychain.NewGenericPassword(k.serviceName(), string(accountName), "", nil, k.accessGroup())
	} else {
		query = keychain.NewGenericPassword(k.serviceName(), string(accountName), "", nil, "")
		query.SetMatchLimit(keychain.MatchLimitAll)
	}
	err := keychain.DeleteItem(query)
	if err == keychain.ErrorItemNotFound {
		k.context.GetLog().Debug("KeychainSecretStore.ClearSecret(%s), item not found", accountName)
		return nil
	}
	if err != nil {
		k.context.GetLog().Debug("KeychainSecretStore.ClearSecret(%s), DeleteItem error: %s", accountName, err)
	}

	k.context.GetLog().Debug("KeychainSecretStore.ClearSecret(%s) success", accountName)

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
	users, err := keychain.GetAccountsForService(k.context.GetStoredSecretServiceName())
	if err != nil {
		k.context.GetLog().Debug("KeychainSecretStore.GetUsersWithStoredSecrets() error: %s", err)
		return nil, err
	}

	k.context.GetLog().Debug("KeychainSecretStore.GetUsersWithStoredSecrets() -> %d users", len(users))
	return users, nil
}

func (k KeychainSecretStore) GetApprovalPrompt() string {
	return "Save in Keychain"
}

func (k KeychainSecretStore) GetTerminalPrompt() string {
	return "Store your key in Apple's local keychain?"
}

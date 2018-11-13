// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package libkb

import (
	"encoding/base64"
	"os"

	keychain "github.com/keybase/go-keychain"
)

type KeychainSecretStore struct {
}

var _ SecretStoreAll = KeychainSecretStore{}

func (k KeychainSecretStore) serviceName(m MetaContext) string {
	return m.G().GetStoredSecretServiceName()
}

func (k KeychainSecretStore) StoreSecret(m MetaContext, accountName NormalizedUsername, secret LKSecFullSecret) (err error) {
	// Base64 encode to make it easy to work with Keychain Access (since we are using a password item and secret is not utf-8)
	encodedSecret := base64.StdEncoding.EncodeToString(secret.Bytes())
	item := keychain.NewGenericPassword(k.serviceName(m), string(accountName), "", []byte(encodedSecret), k.accessGroup(m))
	item.SetSynchronizable(k.synchronizable())
	item.SetAccessible(k.accessible())
	m.CDebugf("KeychainSecretStore.StoreSecret(%s): deleting item before adding new one", accountName)
	err = keychain.DeleteItem(item)
	if err != nil {
		// error probably ok here?
		m.CDebugf("KeychainSecretStore.StoreSecret(%s): DeleteItem error: %s", accountName, err)
	}
	m.CDebugf("KeychainSecretStore.StoreSecret(%s): adding item", accountName)
	err = keychain.AddItem(item)
	if err != nil {
		m.CWarningf("KeychainSecretStore.StoreSecret(%s): AddItem error: %s", accountName, err)
		return err
	}
	m.CDebugf("KeychainSecretStore.StoreSecret(%s): AddItem success", accountName)

	return nil
}

func (k KeychainSecretStore) updateAccessibility(m MetaContext, accountName string) {
	query := keychain.NewItem()
	query.SetSecClass(keychain.SecClassGenericPassword)
	query.SetService(k.serviceName(m))
	query.SetAccount(accountName)
	query.SetMatchLimit(keychain.MatchLimitOne)
	updateItem := keychain.NewItem()
	updateItem.SetAccessible(k.accessible())
	if err := keychain.UpdateItem(query, updateItem); err != nil {
		m.CDebugf("KeychainSecretStore.updateAccessibility: failed: %s", err)
	}
}

func (k KeychainSecretStore) mobileKeychainPermissionDeniedCheck(m MetaContext, err error) {
	m.G().Log.Debug("mobileKeychainPermissionDeniedCheck: checking for mobile permission denied")
	if !isIOS || m.G().GetAppType() != MobileAppType {
		m.G().Log.Debug("mobileKeychainPermissionDeniedCheck: not an iOS app")
		return
	}
	if err != keychain.ErrorInteractionNotAllowed {
		m.G().Log.Debug("mobileKeychainPermissionDeniedCheck: wrong kind of error: %s", err)
		return
	}
	m.G().Log.Warning("mobileKeychainPermissionDeniedCheck: keychain permission denied: %s", err)
	os.Exit(4)
}

func (k KeychainSecretStore) RetrieveSecret(m MetaContext, accountName NormalizedUsername) (LKSecFullSecret, error) {
	m.CDebugf("KeychainSecretStore.RetrieveSecret(%s)", accountName)
	encodedSecret, err := keychain.GetGenericPassword(k.serviceName(m), string(accountName), "", "")
	if err != nil {
		m.CDebugf("KeychainSecretStore.RetrieveSecret(%s) error: %s", accountName, err)
		k.mobileKeychainPermissionDeniedCheck(m, err)
		return LKSecFullSecret{}, err
	}
	if encodedSecret == nil {
		m.CDebugf("KeychainSecretStore.RetrieveSecret(%s) nil encodedSecret", accountName)
		return LKSecFullSecret{}, SecretStoreError{Msg: "No secret for " + string(accountName)}
	}

	secret, err := base64.StdEncoding.DecodeString(string(encodedSecret))
	if err != nil {
		m.CDebugf("KeychainSecretStore.RetrieveSecret(%s) base64.Decode error: %s", accountName, err)
		return LKSecFullSecret{}, err
	}

	m.CDebugf("KeychainSecretStore.RetrieveSecret(%s) got secret, creating lksec", accountName)

	lk, err := newLKSecFullSecretFromBytes(secret)
	if err != nil {
		m.CDebugf("KeychainSecretStore.RetrieveSecret(%s) error creating lksec: %s", accountName, err)
		return LKSecFullSecret{}, err
	}

	// Update accessibility
	k.updateAccessibility(m, accountName.String())

	m.CDebugf("KeychainSecretStore.RetrieveSecret(%s) success", accountName)

	return lk, nil
}

func (k KeychainSecretStore) ClearSecret(m MetaContext, accountName NormalizedUsername) error {
	m.CDebugf("KeychainSecretStore.ClearSecret(%s)", accountName)
	var query keychain.Item
	if isIOS {
		query = keychain.NewGenericPassword(k.serviceName(m), string(accountName), "", nil, k.accessGroup(m))
	} else {
		query = keychain.NewGenericPassword(k.serviceName(m), string(accountName), "", nil, "")
		query.SetMatchLimit(keychain.MatchLimitAll)
	}
	err := keychain.DeleteItem(query)
	if err == keychain.ErrorItemNotFound {
		m.CDebugf("KeychainSecretStore.ClearSecret(%s), item not found", accountName)
		return nil
	}
	if err != nil {
		m.CDebugf("KeychainSecretStore.ClearSecret(%s), DeleteItem error: %s", accountName, err)
	}

	m.CDebugf("KeychainSecretStore.ClearSecret(%s) success", accountName)

	return err
}

func NewSecretStoreAll(m MetaContext) SecretStoreAll {
	if m.G().Env.DarwinForceSecretStoreFile() {
		// Allow use of file secret store for development/testing
		// on MacOS.
		return NewSecretStoreFile(m.G().Env.GetDataDir())
	}
	return KeychainSecretStore{}
}

func HasSecretStore() bool {
	return true
}

func (k KeychainSecretStore) GetUsersWithStoredSecrets(m MetaContext) ([]string, error) {
	users, err := keychain.GetAccountsForService(k.serviceName(m))
	if err != nil {
		m.CDebugf("KeychainSecretStore.GetUsersWithStoredSecrets() error: %s", err)
		return nil, err
	}

	m.CDebugf("KeychainSecretStore.GetUsersWithStoredSecrets() -> %d users", len(users))
	return users, nil
}

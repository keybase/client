// +build darwin,ios

package libkb

import (
	keychain "github.com/keybase/go-keychain"
)

const (
	keychainServiceName = "keybase"
	accessGroup         = ""
)

type KeychainSecretStore struct {
	accountName string
}

func (k KeychainSecretStore) StoreSecret(secret []byte) (err error) {
	// TODO: Access group for iOS
	item := keychain.NewGenericPassword(keychainServiceName, k.accountName, "", secret, accessGroup)
	item.SetSynchronizable(keychain.SynchronizableNo)
	item.SetAccessible(keychain.AccessibleWhenUnlockedThisDeviceOnly)

	keychain.DeleteItem(item)
	return keychain.AddItem(item)
}

func (k KeychainSecretStore) RetrieveSecret() ([]byte, error) {
	return keychain.GetGenericPassword(keychainServiceName, k.accountName, "", "")
}

func (k KeychainSecretStore) ClearSecret() (err error) {
	query := keychain.NewGenericPassword(keychainServiceName, k.accountName, "", nil, "")
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
	return keychain.GetAccountsForService(keychainServiceName)
}

func GetTerminalPrompt() string {
	return "Store your key in Apple's local keychain?"
}

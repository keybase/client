// +build darwin

package libkb

import (
	kc "github.com/keybase/go-osxkeychain"
)

type KeychainSecretStore struct {
	serviceName string
	accountName string
}

func (kss *KeychainSecretStore) StoreSecret(secret []byte) (err error) {
	G.Log.Debug("+ StoreSecret(%s, %d)", kss.accountName, len(secret))
	defer func() {
		G.Log.Debug("- StoreSecret -> %s", ErrToOk(err))
	}()

	attributes := kc.GenericPasswordAttributes{
		ServiceName: kss.serviceName,
		AccountName: kss.accountName,
		Data:        secret,
	}
	err = kc.RemoveAndAddGenericPassword(&attributes)
	return
}

func (kss *KeychainSecretStore) RetrieveSecret() (secret []byte, err error) {
	G.Log.Debug("+ RetrieveSecret(%s)", kss.accountName)
	defer func() {
		G.Log.Debug("- RetrieveSecret -> %s", ErrToOk(err))
	}()

	attributes := kc.GenericPasswordAttributes{
		ServiceName: kss.serviceName,
		AccountName: kss.accountName,
	}

	secret, err = kc.FindGenericPassword(&attributes)
	return
}

func (kss *KeychainSecretStore) ClearSecret() (err error) {
	G.Log.Debug("+ ClearSecret(%s)", kss.accountName)
	defer func() {
		G.Log.Debug("- ClearSecret -> %s", ErrToOk(err))
	}()

	attributes := kc.GenericPasswordAttributes{
		ServiceName: kss.serviceName,
		AccountName: kss.accountName,
	}

	err = kc.FindAndRemoveGenericPassword(&attributes)
	// Don't count the item not being found as an error.
	if err == kc.ErrItemNotFound {
		err = nil
	}
	return
}

func NewSecretStore(serviceName string, accountName string) SecretStore {
	return &KeychainSecretStore{serviceName, accountName}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets(serviceName string) ([]string, error) {
	return kc.GetAllAccountNames(serviceName)
}

func GetTerminalPrompt() string {
	return "Store your key in the Mac OS keychain?"
}

// +build darwin

package libkb

import (
	"encoding/base64"

	kc "github.com/keybase/go-osxkeychain"
)

const (
	keychainServiceName = "keybase"
)

type KeychainSecretStore struct {
	accountName string
}

func (kss *KeychainSecretStore) StoreSecret(secret []byte) (err error) {
	G.Log.Debug("+ StoreSecret(%s, %d)", kss.accountName, len(secret))
	defer func() {
		G.Log.Debug("- StoreSecret -> %s", ErrToOk(err))
	}()

	// base64-encode to make it easy to work with Keychain Access.
	encodedSecret := base64.StdEncoding.EncodeToString(secret)
	attributes := kc.GenericPasswordAttributes{
		ServiceName: keychainServiceName,
		AccountName: kss.accountName,
		Password:    encodedSecret,
	}
	err = kc.ReplaceOrAddGenericPassword(&attributes)
	return
}

func (kss *KeychainSecretStore) RetrieveSecret() (secret []byte, err error) {
	G.Log.Debug("+ RetrieveSecret(%s)", kss.accountName)
	defer func() {
		G.Log.Debug("- RetrieveSecret -> %s", ErrToOk(err))
	}()

	attributes := kc.GenericPasswordAttributes{
		ServiceName: keychainServiceName,
		AccountName: kss.accountName,
	}

	var encodedSecret string
	encodedSecret, err = kc.FindGenericPassword(&attributes)
	if err != nil {
		return
	}

	secret, err = base64.StdEncoding.DecodeString(encodedSecret)
	if err != nil {
		secret = nil
	}

	return
}

func (kss *KeychainSecretStore) ClearSecret() (err error) {
	G.Log.Debug("+ ClearSecret(%s)", kss.accountName)
	defer func() {
		G.Log.Debug("- ClearSecret -> %s", ErrToOk(err))
	}()

	attributes := kc.GenericPasswordAttributes{
		ServiceName: keychainServiceName,
		AccountName: kss.accountName,
	}

	err = kc.FindAndRemoveGenericPassword(&attributes)
	// Don't count the item not being found as an error.
	if err == kc.ErrItemNotFound {
		err = nil
	}
	return
}

func NewSecretStore(username string) SecretStore {
	return &KeychainSecretStore{username}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets() ([]string, error) {
	return kc.GetAllAccountNames(keychainServiceName)
}

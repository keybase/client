// +build android

package libkb

import "sync"

// This represents the interface to the actual keystore
type ExternalKeyStore interface {
	RetrieveSecret(username string) ([]byte, error)
	StoreSecret(username string, secret []byte) error
	ClearSecret(username string) error
	GetUsersWithStoredSecretsMsgPack() ([]byte, error)
	SetupKeyStore(username string) error
	GetTerminalPrompt() string
}

// Represents interface to some external key store
var GlobalExternalKeyStore ExternalKeyStore

var l sync.Mutex

// This is called by Android to register Android's KeyStore with Go
func SetGlobalExternalKeyStore(s ExternalKeyStore) {
	l.Lock()
	defer l.Unlock()
	GlobalExternalKeyStore = s
}

func GetGlobalExternalKeyStore() ExternalKeyStore {
	l.Lock()
	defer l.Unlock()
	return GlobalExternalKeyStore
}

type SecretStoreAccountName struct {
	accountName      string
	externalKeyStore ExternalKeyStore
}

func (s SecretStoreAccountName) StoreSecret(secret []byte) (err error) {
	return s.externalKeyStore.StoreSecret(s.accountName, secret)
}

func (s SecretStoreAccountName) RetrieveSecret() ([]byte, error) {
	return s.externalKeyStore.RetrieveSecret(s.accountName)
}

func (s SecretStoreAccountName) ClearSecret() (err error) {
	return s.externalKeyStore.ClearSecret(s.accountName)
}

func NewSecretStore(username NormalizedUsername) SecretStore {
	externalKeyStore := GetGlobalExternalKeyStore()
	if externalKeyStore == nil {
		return nil
	}
	externalKeyStore.SetupKeyStore(string(username))
	return SecretStoreAccountName{string(username), externalKeyStore}
}

func HasSecretStore() bool {
	return true
}

func GetUsersWithStoredSecrets() ([]string, error) {
	usersMsgPack, err := GetGlobalExternalKeyStore().GetUsersWithStoredSecretsMsgPack()
	if err != nil {
		return nil, err
	}
	var users []string
	ch := codecHandle()
	err = MsgpackDecodeAll(usersMsgPack, ch, users)
	return users, err
}

func GetTerminalPrompt() string {
	return GetGlobalExternalKeyStore().GetTerminalPrompt()
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package libkb

import "sync"

// TODO: Make this implementation use GetStoredSecretServiceName(), as
// otherwise tests will clobber each other's passwords. See
// https://keybase.atlassian.net/browse/CORE-1934 .

// ExternalKeyStore is the interface for the actual (external) keystore.
type ExternalKeyStore interface {
	RetrieveSecret(username string) ([]byte, error)
	StoreSecret(username string, secret []byte) error
	ClearSecret(username string) error
	GetUsersWithStoredSecretsMsgPack() ([]byte, error)
	SetupKeyStore(username string) error
	GetTerminalPrompt() string
}

// externalKeyStore is the reference to some external key store
var externalKeyStore ExternalKeyStore

var externalKeyStoreMu sync.Mutex

// SetGlobalExternalKeyStore is called by Android to register Android's KeyStore with Go
func SetGlobalExternalKeyStore(s ExternalKeyStore) {
	externalKeyStoreMu.Lock()
	defer externalKeyStoreMu.Unlock()
	externalKeyStore = s
}

func getGlobalExternalKeyStore() ExternalKeyStore {
	externalKeyStoreMu.Lock()
	defer externalKeyStoreMu.Unlock()
	return externalKeyStore
}

type secretStoreAccountName struct {
	externalKeyStore ExternalKeyStore
	accountName      string
}

var _ SecretStore = secretStoreAccountName{}

func (s secretStoreAccountName) StoreSecret(secret []byte) (err error) {
	return s.externalKeyStore.StoreSecret(s.accountName, secret)
}

func (s secretStoreAccountName) RetrieveSecret() ([]byte, error) {
	return s.externalKeyStore.RetrieveSecret(s.accountName)
}

func (s secretStoreAccountName) ClearSecret() (err error) {
	return s.externalKeyStore.ClearSecret(s.accountName)
}

func NewSecretStore(g *GlobalContext, username NormalizedUsername) SecretStore {
	externalKeyStore := getGlobalExternalKeyStore()
	if externalKeyStore == nil {
		return nil
	}
	externalKeyStore.SetupKeyStore(string(username))
	return secretStoreAccountName{externalKeyStore, string(username)}
}

func HasSecretStore() bool {
	return getGlobalExternalKeyStore() != nil
}

func GetUsersWithStoredSecrets(g *GlobalContext) ([]string, error) {
	externalKeyStore := getGlobalExternalKeyStore()
	if externalKeyStore == nil {
		return nil, nil
	}
	usersMsgPack, err := externalKeyStore.GetUsersWithStoredSecretsMsgPack()
	if err != nil {
		return nil, err
	}
	var users []string
	ch := codecHandle()
	err = MsgpackDecodeAll(usersMsgPack, ch, &users)
	return users, err
}

func GetTerminalPrompt() string {
	externalKeyStore := getGlobalExternalKeyStore()
	if externalKeyStore == nil {
		return ""
	}
	return externalKeyStore.GetTerminalPrompt()
}

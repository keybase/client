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
}

var _ SecretStore = secretStoreAccountName{}

func (s secretStoreAccountName) StoreSecret(username NormalizedUsername, secret []byte) (err error) {
	externalKeyStore.SetupKeyStore(string(username))
	return s.externalKeyStore.StoreSecret(username, secret)
}

func (s secretStoreAccountName) RetrieveSecret(username NormalizedUsername) ([]byte, error) {
	externalKeyStore.SetupKeyStore(string(username))
	return s.externalKeyStore.RetrieveSecret(username)
}

func (s secretStoreAccountName) ClearSecret(username NormalizedUsername) (err error) {
	return s.externalKeyStore.ClearSecret(username)
}

func NewSecretStoreAll(g *GlobalContext) SecretStoreAll {
	externalKeyStore := getGlobalExternalKeyStore()
	if externalKeyStore == nil {
		return nil
	}
	return secretStoreAccountName{externalKeyStore}
}

func NewTestSecretStoreAll(c SecretStoreContext, g *GlobalContext) SecretStoreAll {
	return nil
}

func (s secretStoreAccountName) GetUsersWithStoredSecrets() ([]string, error) {
	if s.externalKeyStore == nil {
		return nil, nil
	}
	usersMsgPack, err := s.externalKeyStore.GetUsersWithStoredSecretsMsgPack()
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

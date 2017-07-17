// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package libkb

import "sync"

// TODO: Make this implementation use GetStoredSecretServiceName(), as
// otherwise tests will clobber each other's passwords. See
// https://keybase.atlassian.net/browse/CORE-1934 .

// UnsafeExternalKeyStore is a simple interface that external clients can implement.
// It is unsafe because it returns raw bytes instead of the typed LKSecFullSecret
// Use with TypeSafeExternalKeyStoreProxy
type UnsafeExternalKeyStore interface {
	RetrieveSecret(serviceName string, key string) ([]byte, error)
	StoreSecret(serviceName string, key string, secret []byte) error
	ClearSecret(serviceName string, key string) error
	GetUsersWithStoredSecretsMsgPack(serviceName string) ([]byte, error)
	SetupKeyStore(serviceName string, key string) error
}

// ExternalKeyStore is the interface for the actual (external) keystore.
type ExternalKeyStore interface {
	RetrieveSecret(serviceName string, key string) (LKSecFullSecret, error)
	StoreSecret(serviceName string, key string, secret LKSecFullSecret) error
	ClearSecret(serviceName string, key string) error
	GetUsersWithStoredSecretsMsgPack(serviceName string) ([]byte, error)
	SetupKeyStore(serviceName string, key string) error
}

// TypeSafeExternalKeyStoreProxy wraps the UnsafeExternalKeyStore to provide
// the type-safe ExternalKeyStore interface to the rest of the code
type TypeSafeExternalKeyStoreProxy struct {
	UnsafeExternalKeyStore UnsafeExternalKeyStore
}

func (w TypeSafeExternalKeyStoreProxy) RetrieveSecret(serviceName string, key string) (LKSecFullSecret, error) {
	bytes, err := w.UnsafeExternalKeyStore.RetrieveSecret(serviceName, key)
	if err != nil {
		return LKSecFullSecret{}, err
	}

	return newLKSecFullSecretFromBytes(bytes)
}

func (w TypeSafeExternalKeyStoreProxy) StoreSecret(serviceName string, key string, secret LKSecFullSecret) error {
	return w.UnsafeExternalKeyStore.StoreSecret(serviceName, key, secret.Bytes())
}

func (w TypeSafeExternalKeyStoreProxy) ClearSecret(serviceName string, key string) error {
	return w.UnsafeExternalKeyStore.ClearSecret(serviceName, key)
}

func (w TypeSafeExternalKeyStoreProxy) GetUsersWithStoredSecretsMsgPack(serviceName string) ([]byte, error) {
	return w.UnsafeExternalKeyStore.GetUsersWithStoredSecretsMsgPack(serviceName)
}

func (w TypeSafeExternalKeyStoreProxy) SetupKeyStore(serviceName string, key string) error {
	return w.UnsafeExternalKeyStore.SetupKeyStore(serviceName, key)
}

// externalKeyStore is the reference to some external key store
var externalKeyStore ExternalKeyStore

var externalKeyStoreMu sync.Mutex

func (s *secretStoreAccountName) serviceName() string {
	return s.context.GetStoredSecretServiceName()
}

// SetGlobalExternalKeyStore is called by Android to register Android's KeyStore with Go
func SetGlobalExternalKeyStore(s UnsafeExternalKeyStore) {
	externalKeyStoreMu.Lock()
	defer externalKeyStoreMu.Unlock()
	externalKeyStore = TypeSafeExternalKeyStoreProxy{s}
}

func getGlobalExternalKeyStore() ExternalKeyStore {
	externalKeyStoreMu.Lock()
	defer externalKeyStoreMu.Unlock()
	return externalKeyStore
}

type secretStoreAccountName struct {
	externalKeyStore ExternalKeyStore
	context          SecretStoreContext
	setupOnce        sync.Once
}

var _ SecretStoreAll = &secretStoreAccountName{}

func NewSecretStoreAll(g *GlobalContext) SecretStoreAll {
	externalKeyStore := getGlobalExternalKeyStore()
	if externalKeyStore == nil {
		return nil
	}
	s := &secretStoreAccountName{
		externalKeyStore: externalKeyStore,
		context:          g,
	}
	go s.setup()
	return s
}

func (s *secretStoreAccountName) StoreSecret(username NormalizedUsername, secret LKSecFullSecret) (err error) {
	defer TraceTimed(s.context.GetLog(), "secret_store_external StoreSecret", func() error { return err })()
	s.setup()
	return s.externalKeyStore.StoreSecret(s.serviceName(), string(username), secret)
}

func (s *secretStoreAccountName) RetrieveSecret(username NormalizedUsername) (sec LKSecFullSecret, err error) {
	defer TraceTimed(s.context.GetLog(), "secret_store_external RetrieveSecret", func() error { return err })()
	s.setup()
	return s.externalKeyStore.RetrieveSecret(s.serviceName(), string(username))
}

func (s *secretStoreAccountName) ClearSecret(username NormalizedUsername) (err error) {
	defer TraceTimed(s.context.GetLog(), "secret_store_external ClearSecret", func() error { return err })()
	return s.externalKeyStore.ClearSecret(s.serviceName(), string(username))
}

func (s *secretStoreAccountName) GetUsersWithStoredSecrets() ([]string, error) {
	if s.externalKeyStore == nil {
		return nil, nil
	}
	usersMsgPack, err := s.externalKeyStore.GetUsersWithStoredSecretsMsgPack(s.serviceName())
	if err != nil {
		return nil, err
	}
	var users []string
	ch := codecHandle()
	err = MsgpackDecodeAll(usersMsgPack, ch, &users)
	return users, err
}

func (s *secretStoreAccountName) GetTerminalPrompt() string {
	return "Store secret in Android's KeyStore?"
}

func (s *secretStoreAccountName) GetApprovalPrompt() string {
	return "Store secret in Android's KeyStore?"
}

func (s *secretStoreAccountName) setup() {
	s.setupOnce.Do(func() {
		s.context.GetLog().Debug("+ secret_store_external:setup")
		// username not required
		s.externalKeyStore.SetupKeyStore(s.serviceName(), "")
		s.context.GetLog().Debug("- secret_store_external:setup")
	})
}

func NewTestSecretStoreAll(c SecretStoreContext, g *GlobalContext) SecretStoreAll {
	return nil
}

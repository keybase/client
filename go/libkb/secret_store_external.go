// Copyright 2018 Keybase, Inc. All rights reserved. Use of
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

func (s *secretStoreAccountName) serviceName(m MetaContext) string {
	return m.G().GetStoredSecretServiceName()
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
	setupOnce        sync.Once
}

var _ SecretStoreAll = &secretStoreAccountName{}

func NewSecretStoreAll(m MetaContext) SecretStoreAll {
	externalKeyStore := getGlobalExternalKeyStore()
	if externalKeyStore == nil {
		return nil
	}
	s := &secretStoreAccountName{
		externalKeyStore: externalKeyStore,
	}
	go s.setup(m)
	return s
}

func (s *secretStoreAccountName) StoreSecret(m MetaContext, username NormalizedUsername, secret LKSecFullSecret) (err error) {
	defer m.CTraceTimed("secret_store_external StoreSecret", func() error { return err })()
	s.setup(m)
	return s.externalKeyStore.StoreSecret(s.serviceName(m), string(username), secret)
}

func (s *secretStoreAccountName) RetrieveSecret(m MetaContext, username NormalizedUsername) (sec LKSecFullSecret, err error) {
	defer m.CTraceTimed("secret_store_external RetrieveSecret", func() error { return err })()
	s.setup(m)
	return s.externalKeyStore.RetrieveSecret(s.serviceName(m), string(username))
}

func (s *secretStoreAccountName) ClearSecret(m MetaContext, username NormalizedUsername) (err error) {
	defer m.CTraceTimed("secret_store_external ClearSecret", func() error { return err })()
	return s.externalKeyStore.ClearSecret(s.serviceName(m), string(username))
}

func (s *secretStoreAccountName) GetUsersWithStoredSecrets(m MetaContext) ([]string, error) {
	if s.externalKeyStore == nil {
		return nil, nil
	}
	usersMsgPack, err := s.externalKeyStore.GetUsersWithStoredSecretsMsgPack(s.serviceName(m))
	if err != nil {
		return nil, err
	}
	var users []string
	ch := codecHandle()
	err = MsgpackDecodeAll(usersMsgPack, ch, &users)
	return users, err
}

func (s *secretStoreAccountName) setup(m MetaContext) {
	s.setupOnce.Do(func() {
		m.CDebugf("+ secret_store_external:setup")

		// username not required
		err := s.externalKeyStore.SetupKeyStore(s.serviceName(m), "")
		if err != nil {
			m.CDebugf("externalKeyStore.SetupKeyStore(%s) error: %s (%T)", s.serviceName(m), err, err)
		} else {
			m.CDebugf("externalKeyStore.SetupKeyStore(%s) success", s.serviceName(m))
		}

		m.CDebugf("- secret_store_external:setup")
	})
}

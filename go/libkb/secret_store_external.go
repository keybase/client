// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build android

package libkb

import (
	"errors"
	"sync"
)

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
var externalKeyStoreInitialized bool
var externalKeyStoreMu sync.Mutex

// SetGlobalExternalKeyStore is called by Android to register Android's KeyStore with Go
func SetGlobalExternalKeyStore(s UnsafeExternalKeyStore) {
	externalKeyStoreMu.Lock()
	defer externalKeyStoreMu.Unlock()
	externalKeyStore = TypeSafeExternalKeyStoreProxy{s}
	externalKeyStoreInitialized = false
}

var noExternalKeyStore = errors.New("no external key store available")

func getGlobalExternalKeyStore(m MetaContext) (ExternalKeyStore, error) {
	externalKeyStoreMu.Lock()
	defer externalKeyStoreMu.Unlock()

	if externalKeyStore == nil {
		// perhaps SetGlobalExternalKeyStore has not been called by Android internals yet:
		m.CDebugf("secret_store_external:getGlobalExternalKeyStore called, but externalKeyStore is nil")
		return nil, noExternalKeyStore
	}

	// always check this since perhaps SetGlobalExternalKeyStore called more than once
	if !externalKeyStoreInitialized {
		m.CDebugf("+ secret_store_external:setup (in getGlobalExternalKeyStore)")
		defer m.CDebugf("- secret_store_external:setup (in getGlobalExternalKeyStore)")

		serviceName := m.G().GetStoredSecretServiceName()

		// username not required
		err := externalKeyStore.SetupKeyStore(serviceName, "")
		if err != nil {
			m.CDebugf("externalKeyStore.SetupKeyStore(%s) error: %s (%T)", serviceName, err, err)
			return nil, err
		}

		m.CDebugf("externalKeyStore.SetupKeyStore(%s) success", serviceName)
		externalKeyStoreInitialized = true
	}

	return externalKeyStore, nil
}

type secretStoreAndroid struct{}

var _ SecretStoreAll = &secretStoreAndroid{}

func NewSecretStoreAll(m MetaContext) SecretStoreAll {
	return &secretStoreAndroid{}
}

func (s *secretStoreAndroid) serviceName(m MetaContext) string {
	return m.G().GetStoredSecretServiceName()
}

func (s *secretStoreAndroid) StoreSecret(m MetaContext, username NormalizedUsername, secret LKSecFullSecret) (err error) {
	defer m.CTraceTimed("secret_store_external StoreSecret", func() error { return err })()
	ks, err := getGlobalExternalKeyStore(m)
	if err != nil {
		return err
	}

	return ks.StoreSecret(s.serviceName(m), string(username), secret)
}

func (s *secretStoreAndroid) RetrieveSecret(m MetaContext, username NormalizedUsername) (sec LKSecFullSecret, err error) {
	defer m.CTraceTimed("secret_store_external RetrieveSecret", func() error { return err })()

	ks, err := getGlobalExternalKeyStore(m)
	if err != nil {
		return sec, err
	}

	return ks.RetrieveSecret(s.serviceName(m), string(username))
}

func (s *secretStoreAndroid) ClearSecret(m MetaContext, username NormalizedUsername) (err error) {
	defer m.CTraceTimed("secret_store_external ClearSecret", func() error { return err })()

	ks, err := getGlobalExternalKeyStore(m)
	if err != nil {
		return err
	}

	return ks.ClearSecret(s.serviceName(m), string(username))
}

func (s *secretStoreAndroid) GetUsersWithStoredSecrets(m MetaContext) (users []string, err error) {
	defer m.CTraceTimed("secret_store_external GetUsersWithStoredSecrets", func() error { return err })()

	ks, err := getGlobalExternalKeyStore(m)
	if err != nil {
		if err == noExternalKeyStore {
			// this is to match previous behavior of this function,
			// but perhaps it should return the error instead
			return nil, nil
		}
		return nil, err
	}
	usersMsgPack, err := ks.GetUsersWithStoredSecretsMsgPack(s.serviceName(m))
	if err != nil {
		return nil, err
	}
	ch := codecHandle()
	err = MsgpackDecodeAll(usersMsgPack, ch, &users)
	return users, err
}

// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package libkb

import (
	"strings"

	"github.com/danieljoos/wincred"
)

type WinCredentialStore struct {
	context SecretStoreContext
}

var _ SecretStoreAll = WinCredentialStore{}

func (k WinCredentialStore) serviceName() string {
	return k.context.GetStoredSecretServiceName() + "_CREDENTIAL_STORE_"
}

func (k WinCredentialStore) StoreSecret(accountName NormalizedUsername, secret LKSecFullSecret) (err error) {
	k.context.GetLog().Debug("WinCredentialStore.StoreSecret(%s)", accountName)
	p := wincred.NewGenericCredential(k.serviceName() + string(accountName))
	if p == nil {
		return SecretStoreError{Msg: "NewDomainPassword failure"}
	}
	p.CredentialBlob = secret.Bytes()
	return p.Write()
}

func (k WinCredentialStore) RetrieveSecret(accountName NormalizedUsername) (LKSecFullSecret, error) {
	k.context.GetLog().Debug("WinCredentialStore.RetrieveSecret(%s)", accountName)

	p, err := wincred.GetGenericCredential(k.serviceName() + string(accountName))
	if err != nil {
		k.context.GetLog().Debug("WinCredentialStore.RetrieveSecret(%s) error: %s", accountName, err)
		return LKSecFullSecret{}, err
	}
	if p == nil || p.CredentialBlob == nil {
		k.context.GetLog().Debug("WinCredentialStore.RetrieveSecret(%s) nil DomainPassword", accountName)
		return LKSecFullSecret{}, SecretStoreError{Msg: "No secret for " + string(accountName)}
	}

	lk, err := newLKSecFullSecretFromBytes(p.CredentialBlob)
	if err != nil {
		k.context.GetLog().Debug("WinCredentialStore.RetrieveSecret(%s) error creating lksec: %s", accountName, err)
		return LKSecFullSecret{}, err
	}

	k.context.GetLog().Debug("WinCredentialStore.RetrieveSecret(%s) success", accountName)

	return lk, nil
}

func (k WinCredentialStore) ClearSecret(accountName NormalizedUsername) error {
	k.context.GetLog().Debug("WinCredentialStore.ClearSecret(%s)", accountName)

	p, err := wincred.GetGenericCredential(k.serviceName() + string(accountName))
	// test expects no error when cred not found (?)
	if p == nil {
		return nil
	}
	if err != nil {
		return err
	}

	err = p.Delete()
	if err != nil {
		k.context.GetLog().Debug("WinCredentialStore.ClearSecret(%s), DeleteItem error: %s", accountName, err)
		return err
	}

	k.context.GetLog().Debug("WinCredentialStore.ClearSecret(%s) success", accountName)

	return err
}

// Move secrets out of files and into the windows cred store
func (k WinCredentialStore) migrateSecretStoreFile(g *GlobalContext) error {
	fileStore := NewSecretStoreFile(g.Env.GetDataDir())
	fileUsers, err := fileStore.GetUsersWithStoredSecrets()
	if err == nil && len(fileUsers) > 0 {
		k.context.GetLog().Debug("WinCredentialStore.migrateSecretStoreFile() migrating %d file users", len(fileUsers))
		for _, fileUser := range fileUsers {
			fileSecret, err := fileStore.RetrieveSecret(NormalizedUsername(fileUser))
			if err != nil {
				continue
			}
			err = k.StoreSecret(NormalizedUsername(fileUser), fileSecret)
			if err != nil {
				continue
			}
			fileStore.ClearSecret(NormalizedUsername(fileUser))
		}
	}
	return nil
}

func NewSecretStoreAll(g *GlobalContext) SecretStoreAll {
	if g.Env.ForceSecretStoreFile() || !g.Env.GetFeatureFlags().Admin() {
		// Allow use of file secret store for development/testing
		return NewSecretStoreFile(g.Env.GetDataDir())
	}
	store := WinCredentialStore{context: g}
	store.migrateSecretStoreFile(g)
	return store
}

func HasSecretStore() bool {
	return true
}

func (k WinCredentialStore) GetUsersWithStoredSecrets() ([]string, error) {
	creds, err := wincred.List()
	if err != nil {
		k.context.GetLog().Debug("WinCredentialStore.GetUsersWithStoredSecrets() error: %s", err)
		return nil, err
	}
	users := []string{}
	for _, cred := range creds {
		if !strings.HasPrefix(cred.TargetName, k.serviceName()) {
			continue
		}
		users = append(users, strings.TrimPrefix(cred.TargetName, k.serviceName()))
	}

	k.context.GetLog().Debug("WinCredentialStore.GetUsersWithStoredSecrets() -> %d users", len(users))
	return users, nil
}

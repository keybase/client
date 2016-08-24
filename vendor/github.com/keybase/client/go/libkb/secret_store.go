// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import keybase1 "github.com/keybase/client/go/protocol/keybase1"

type SecretRetriever interface {
	RetrieveSecret() ([]byte, error)
}

type SecretStorer interface {
	StoreSecret(secret []byte) error
}

type SecretStore interface {
	SecretRetriever
	SecretStorer
}

type SecretStoreAll interface {
	RetrieveSecret(username NormalizedUsername) ([]byte, error)
	StoreSecret(username NormalizedUsername, secret []byte) error
	ClearSecret(username NormalizedUsername) error
	GetUsersWithStoredSecrets() ([]string, error)
	GetApprovalPrompt() string
	GetTerminalPrompt() string
}

type SecretStoreContext interface {
	GetAllUserNames() (NormalizedUsername, []NormalizedUsername, error)
	GetStoredSecretServiceName() string
	GetStoredSecretAccessGroup() string
}

type SecretStoreImp struct {
	username NormalizedUsername
	store    SecretStoreAll
}

func (s SecretStoreImp) RetrieveSecret() ([]byte, error) {
	return s.store.RetrieveSecret(s.username)
}

func (s SecretStoreImp) StoreSecret(secret []byte) error {
	return s.store.StoreSecret(s.username, secret)
}

func NewSecretStore(g *GlobalContext, username NormalizedUsername) SecretStore {
	if g.SecretStoreAll != nil {
		return SecretStoreImp{username, g.SecretStoreAll}
	}
	return nil
}

func GetConfiguredAccounts(c SecretStoreContext, s SecretStoreAll) ([]keybase1.ConfiguredAccount, error) {
	currentUsername, otherUsernames, err := c.GetAllUserNames()
	if err != nil {
		return nil, err
	}

	allUsernames := append(otherUsernames, currentUsername)

	accounts := make(map[NormalizedUsername]keybase1.ConfiguredAccount)

	for _, username := range allUsernames {
		accounts[username] = keybase1.ConfiguredAccount{
			Username: username.String(),
		}
	}
	var storedSecretUsernames []string
	if s != nil {
		storedSecretUsernames, err = s.GetUsersWithStoredSecrets()
	}
	if err != nil {
		return nil, err
	}

	for _, username := range storedSecretUsernames {
		nu := NewNormalizedUsername(username)
		account, ok := accounts[nu]
		if ok {
			account.HasStoredSecret = true
			accounts[nu] = account
		}
	}

	configuredAccounts := make([]keybase1.ConfiguredAccount, 0, len(accounts))
	for _, account := range accounts {
		configuredAccounts = append(configuredAccounts, account)
	}

	return configuredAccounts, nil
}

func ClearStoredSecret(g *GlobalContext, username NormalizedUsername) error {
	if g.SecretStoreAll == nil {
		return nil
	}
	return g.SecretStoreAll.ClearSecret(username)
}

// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"sync"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type SecretRetriever interface {
	RetrieveSecret() (LKSecFullSecret, error)
}

type SecretStorer interface {
	StoreSecret(secret LKSecFullSecret) error
}

type SecretStore interface {
	SecretRetriever
	SecretStorer
}

type SecretStoreAll interface {
	RetrieveSecret(username NormalizedUsername) (LKSecFullSecret, error)
	StoreSecret(username NormalizedUsername, secret LKSecFullSecret) error
	ClearSecret(username NormalizedUsername) error
	GetUsersWithStoredSecrets() ([]string, error)
	GetApprovalPrompt() string
	GetTerminalPrompt() string
}

type SecretStoreContext interface {
	GetAllUserNames() (NormalizedUsername, []NormalizedUsername, error)
	GetStoredSecretServiceName() string
	GetStoredSecretAccessGroup() string
	GetLog() logger.Logger
}

type SecretStoreImp struct {
	username NormalizedUsername
	store    *SecretStoreLocked
}

func (s *SecretStoreImp) RetrieveSecret() (LKSecFullSecret, error) {
	return s.store.RetrieveSecret(s.username)
}

func (s *SecretStoreImp) StoreSecret(secret LKSecFullSecret) error {
	return s.store.StoreSecret(s.username, secret)
}

func NewSecretStore(g *GlobalContext, username NormalizedUsername) SecretStore {
	if g.SecretStoreAll != nil {
		return &SecretStoreImp{
			username: username,
			store:    g.SecretStoreAll,
		}
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

// SecretStoreLocked protects a SecretStoreAll with a mutex.
type SecretStoreLocked struct {
	SecretStoreAll
	sync.Mutex
}

func NewSecretStoreLocked(g *GlobalContext) *SecretStoreLocked {
	ss := NewSecretStoreAll(g)
	if ss == nil {
		// right now, some stuff depends on g.SecretStoreAll being nil or not
		return nil
	}
	return &SecretStoreLocked{
		SecretStoreAll: ss,
	}
}

func (s *SecretStoreLocked) RetrieveSecret(username NormalizedUsername) (LKSecFullSecret, error) {
	if s == nil || s.SecretStoreAll == nil {
		return LKSecFullSecret{}, nil
	}
	s.Lock()
	defer s.Unlock()
	return s.SecretStoreAll.RetrieveSecret(username)
}

func (s *SecretStoreLocked) StoreSecret(username NormalizedUsername, secret LKSecFullSecret) error {
	if s == nil || s.SecretStoreAll == nil {
		return nil
	}
	s.Lock()
	defer s.Unlock()
	return s.SecretStoreAll.StoreSecret(username, secret)
}

func (s *SecretStoreLocked) ClearSecret(username NormalizedUsername) error {
	if s == nil || s.SecretStoreAll == nil {
		return nil
	}
	s.Lock()
	defer s.Unlock()
	return s.SecretStoreAll.ClearSecret(username)
}

func (s *SecretStoreLocked) GetUsersWithStoredSecrets() ([]string, error) {
	if s == nil || s.SecretStoreAll == nil {
		return nil, nil
	}
	s.Lock()
	defer s.Unlock()
	return s.SecretStoreAll.GetUsersWithStoredSecrets()
}

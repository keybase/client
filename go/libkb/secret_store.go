// Copyright 2015 Keybase, Inc. All rights reserved. Use of
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

// SecretStore stores/retreives the keyring-resident secrets for a given user.
type SecretStore interface {
	SecretRetriever
	SecretStorer
}

// SecretStoreall stores/retreives the keyring-resider secrets for **all** users
// on this system.
type SecretStoreAll interface {
	RetrieveSecret(username NormalizedUsername) (LKSecFullSecret, error)
	StoreSecret(username NormalizedUsername, secret LKSecFullSecret) error
	ClearSecret(username NormalizedUsername) error
	GetUsersWithStoredSecrets() ([]string, error)
}

type SecretStoreContext interface {
	GetAllUserNames() (NormalizedUsername, []NormalizedUsername, error)
	GetStoredSecretServiceName() string
	GetStoredSecretAccessGroup() string
	GetLog() logger.Logger
}

// SecretStoreImp is a specialization of a SecretStoreAll for just one username.
// You specify that username at the time on construction and then it doesn't change.
type SecretStoreImp struct {
	username NormalizedUsername
	store    *SecretStoreLocked
	secret   LKSecFullSecret
	sync.Mutex
}

var _ SecretStore = (*SecretStoreImp)(nil)

func (s *SecretStoreImp) RetrieveSecret() (LKSecFullSecret, error) {
	s.Lock()
	defer s.Unlock()

	if !s.secret.IsNil() {
		return s.secret, nil
	}
	sec, err := s.store.RetrieveSecret(s.username)
	if err != nil {
		return sec, err
	}
	s.secret = sec
	return sec, nil
}

func (s *SecretStoreImp) StoreSecret(secret LKSecFullSecret) error {
	s.Lock()
	defer s.Unlock()

	// clear out any in-memory secret in this instance
	s.secret = LKSecFullSecret{}
	return s.store.StoreSecret(s.username, secret)
}

// NewSecretStore returns a SecretStore interface that is only used for
// a short period of time (i.e. one function block).  Multiple calls to RetrieveSecret()
// will only call the underlying store.RetrieveSecret once.
func NewSecretStore(g *GlobalContext, username NormalizedUsername) SecretStore {
	store := g.SecretStore()
	if store != nil {
		return &SecretStoreImp{
			username: username,
			store:    store,
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
	ss := g.SecretStore()
	if ss == nil {
		return nil
	}
	return ss.ClearSecret(username)
}

// SecretStoreLocked protects a SecretStoreAll with a mutex. It wraps two different
// SecretStoreAlls: one in memory and one in disk. In all cases, we always have a memory
// backing. If the OS and options provide one, we can additionally have a disk-backed
// secret store. It's a write-through cache, so on RetrieveSecret, the memory store
// will be checked first, and then the disk store.
type SecretStoreLocked struct {
	Contextified
	sync.Mutex
	mem  SecretStoreAll
	disk SecretStoreAll
}

func NewSecretStoreLocked(g *GlobalContext) *SecretStoreLocked {
	var disk SecretStoreAll

	mem := NewSecretStoreMem()

	if g.Env.RememberPassphrase() {
		// use os-specific secret store
		g.Log.Debug("NewSecretStoreLocked: using os-specific SecretStore")
		disk = NewSecretStoreAll(g)
	} else {
		// config or command line flag said to use in-memory secret store
		g.Log.Debug("NewSecretStoreLocked: using memory-only SecretStore")
	}

	return &SecretStoreLocked{
		Contextified: NewContextified(g),
		mem:          mem,
		disk:         disk,
	}
}

func (s *SecretStoreLocked) isNil() bool {
	return s.mem == nil && s.disk == nil
}

func (s *SecretStoreLocked) RetrieveSecret(username NormalizedUsername) (LKSecFullSecret, error) {
	if s == nil || s.isNil() {
		return LKSecFullSecret{}, nil
	}
	s.Lock()
	defer s.Unlock()

	res, err := s.mem.RetrieveSecret(username)
	if !res.IsNil() && err == nil {
		return res, nil
	}
	if err != nil {
		s.G().Log.Debug("SecretStoreLocked#RetrieveSecret: memory fetch error: %s", err.Error())
	}
	if s.disk == nil {
		return res, err
	}

	res, err = s.disk.RetrieveSecret(username)
	if err != nil {
		return res, err
	}
	tmp := s.mem.StoreSecret(username, res)
	if tmp != nil {
		s.G().Log.Debug("SecretStoreLocked#RetrieveSecret: failed to store secret in memory: %s", err.Error())
	}
	return res, err
}

func (s *SecretStoreLocked) StoreSecret(username NormalizedUsername, secret LKSecFullSecret) error {
	if s == nil || s.isNil() {
		return nil
	}
	s.Lock()
	defer s.Unlock()
	err := s.mem.StoreSecret(username, secret)
	if err != nil {
		s.G().Log.Debug("SecretStoreLocked#StoreSecret: failed to store secret in memory: %s", err.Error())
	}
	if s.disk == nil {
		return err
	}
	return s.disk.StoreSecret(username, secret)
}

func (s *SecretStoreLocked) ClearSecret(username NormalizedUsername) error {
	if s == nil || s.isNil() {
		return nil
	}
	s.Lock()
	defer s.Unlock()
	err := s.mem.ClearSecret(username)
	if err != nil {
		s.G().Log.Debug("SecretStoreLocked#ClearSecret: failed to clear memory: %s", err.Error())
	}
	if s.disk == nil {
		return err
	}
	return s.disk.ClearSecret(username)
}

func (s *SecretStoreLocked) GetUsersWithStoredSecrets() ([]string, error) {
	if s == nil || s.isNil() {
		return nil, nil
	}
	s.Lock()
	defer s.Unlock()
	if s.disk == nil {
		return s.mem.GetUsersWithStoredSecrets()
	}
	return s.disk.GetUsersWithStoredSecrets()
}
